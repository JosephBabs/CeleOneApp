// CantiqueDetails.tsx (Premium redesign + language switch + copy/share + audio play + scoring modal)
// Requirements:
// - react-native-webview
// - react-native-vector-icons/Ionicons
// - (optional but recommended) expo-av OR react-native-track-player OR react-native-nitro-sound
//   This implementation uses react-native-nitro-sound (simple). If you use another, tell me and I’ll adapt.
// - Clipboard uses @react-native-clipboard/clipboard
// - Share uses react-native Share API
// - Firestore: cantiques collection with fields: hymnNumber, language, title, musicalKey, hymnContent, audioUrl?, scoreUrl?, scoreHtml?
//
// NOTE: This file is self-contained. Keep your COLORS / d_assets / styless imports.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { WebView } from "react-native-webview";
import Clipboard from "@react-native-clipboard/clipboard";

import { COLORS } from "../../../core/theme/colors";
// import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";

// If you use another audio library, tell me and I will adapt.
// yarn add react-native-nitro-sound
// npx pod-install
import Sound from "react-native-sound";
Sound.setCategory("Playback");

type HymnDoc = {
  id: string;
  title?: string;
  hymnNumber: number;
  musicalKey?: string;
  hymnContent?: string;
  language: string;
  audioUrl?: string;
  scoreUrl?: string;   // image/pdf url if you have
  scoreHtml?: string;  // optional html scoring/notation
};

type RouteParams = {
  cantique: HymnDoc;
};

const LANGS = [
  { code: "goun", labelKey: "cantiques.lang_goun", fallback: "Goun" },
  { code: "yoruba", labelKey: "cantiques.lang_yoruba", fallback: "Yorùbá" },
  { code: "francais", labelKey: "cantiques.lang_francais", fallback: "Français" },
  { code: "anglais", labelKey: "cantiques.lang_anglais", fallback: "English" },
];

export default function CantiqueDetails({ route, navigation }: any) {
  const { cantique }: RouteParams = route.params;

  const hymnNumber = cantique?.hymnNumber;
  const initialLang = cantique?.language || "goun";

  const [selectedLang, setSelectedLang] = useState(initialLang);
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const [loadingLang, setLoadingLang] = useState(false);
  const [current, setCurrent] = useState<HymnDoc>(cantique);
  const [notAvailable, setNotAvailable] = useState(false);

  // scoring modal
  const [scoreVisible, setScoreVisible] = useState(false);

  // audio
  const soundRef = useRef<Sound | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      try {
        soundRef.current?.stop(() => {});
        soundRef.current?.release();
      } catch {}
    };
  }, []);

  // when language changes -> fetch same hymnNumber in that language
  useEffect(() => {
    if (!hymnNumber) return;
    if (selectedLang === current?.language) return;

    const fetchByLanguage = async () => {
      try {
        setLoadingLang(true);
        setNotAvailable(false);

        const q = query(
          collection(db, "cantiques"),
          where("hymnNumber", "==", hymnNumber),
          where("language", "==", selectedLang),
          limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) {
          setNotAvailable(true);
          return;
        }

        const docu = snap.docs[0];
        const data = { id: docu.id, ...(docu.data() as any) } as HymnDoc;
        setCurrent(data);

        // stop audio when switching
        stopAudio();
      } catch (e) {
        console.error("fetchByLanguage error", e);
        Alert.alert("Error", "Failed to load hymn for selected language.");
      } finally {
        setLoadingLang(false);
      }
    };

    fetchByLanguage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLang]);

  const titleText = useMemo(() => {
    const t = current?.title?.trim();
    return t && t.length > 0 ? t : `Hymn ${hymnNumber}`;
  }, [current?.title, hymnNumber]);

  const hymnKeyText = useMemo(() => {
    const k = current?.musicalKey?.trim();
    return k && k.length > 0 ? k : "—";
  }, [current?.musicalKey]);

  const plainTextContent = useMemo(() => {
    // If your hymnContent is HTML, we strip tags for copy/share fallback
    const html = current?.hymnContent || "";
    const stripped = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    return stripped || "No content available";
  }, [current?.hymnContent]);

  const htmlContent = useMemo(() => {
    const body = current?.hymnContent || "<p>No content available</p>";
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            padding: 14px 14px 22px 14px;
            margin: 0;
            background-color: #ffffff;
            color: #161616;
            font-size: 20px;
            line-height: 1.55;
          }
          p { margin: 10px 0; }
          h3,h2,h1 { margin: 14px 0 8px 0; }
          strong { font-weight: 700; }
          em { font-style: italic; }
          ul,ol { margin: 10px 0; padding-left: 20px; }
          li { margin: 6px 0; }
          blockquote {
            border-left: 4px solid #EAE8C8;
            padding-left: 12px;
            margin: 16px 0;
            color: #4b4b4b;
          }
          .chip {
            display:inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            background: #F6F6F6;
            font-size: 13px;
            color: #444;
            margin-right: 6px;
          }
        </style>
      </head>
      <body>
        ${body}
      </body>
      </html>
    `;
  }, [current?.hymnContent]);

  const stopAudio = () => {
    try {
      setPlaying(false);
      setAudioError(null);
      soundRef.current?.stop(() => {});
      soundRef.current?.release();
      soundRef.current = null;
    } catch {}
  };

  const toggleAudio = async () => {
    try {
      setAudioError(null);

      const url = current?.audioUrl;
      if (!url) {
        Alert.alert("Audio", "Audio not available for this hymn.");
        return;
      }

      // already loaded
      if (soundRef.current) {
        if (playing) {
          soundRef.current.pause();
          setPlaying(false);
        } else {
          soundRef.current.play((success) => {
            setPlaying(false);
            if (!success) setAudioError("Playback failed.");
          });
          setPlaying(true);
        }
        return;
      }

      // load from URL
      setAudioLoading(true);

      const s = new Sound(url, undefined as any, (error) => {
        setAudioLoading(false);
        if (error) {
          console.log("Sound load error", error);
          setAudioError("Audio failed to load.");
          Alert.alert("Audio", "Failed to load audio.");
          return;
        }

        soundRef.current = s;
        s.play((success) => {
          setPlaying(false);
          if (!success) setAudioError("Playback failed.");
        });
        setPlaying(true);
      });
    } catch (e) {
      console.error(e);
      setAudioLoading(false);
      Alert.alert("Audio", "Something went wrong.");
    }
  };

  const onCopy = () => {
    Clipboard.setString(`${titleText}\n\n${plainTextContent}`);
    Alert.alert("Copied", "Hymn text copied to clipboard.");
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `${titleText}\nKey: ${hymnKeyText}\n\n${plainTextContent}`,
      });
    } catch (e) {
      console.error("share error", e);
    }
  };

  const openScore = () => {
    // If no scoring info, show not available
    if (!current?.scoreUrl && !current?.scoreHtml) {
      Alert.alert("Score", "Scoring is not available for this hymn.");
      return;
    }
    setScoreVisible(true);
  };

  return (
    <View style={styles.screen}>
      {/* Premium header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>

          <Image source={d_assets.images.appLogo} style={styles.logo} />

          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setLangPickerVisible(true)}>
            <Icon name="globe-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroNumber}>#{hymnNumber}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{titleText}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Icon name="musical-notes-outline" size={14} color={COLORS.light.primary} />
                <Text style={styles.metaChipText}>Key: {hymnKeyText}</Text>
              </View>

              <View style={[styles.metaChip, { backgroundColor: "#F7F7F7" }]}>
                <Icon name="language-outline" size={14} color="#444" />
                <Text style={styles.metaChipText}>
                  {selectedLang.toUpperCase()}
                  {notAvailable ? " • N/A" : ""}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroRight}>
            <TouchableOpacity style={styles.primaryPlayBtn} onPress={toggleAudio} activeOpacity={0.9}>
              {audioLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Icon name={playing ? "pause" : "play"} size={22} color="#fff" />
              )}
            </TouchableOpacity>

            <Text style={styles.playLabel}>
              {current?.audioUrl ? (playing ? "Pause" : "Play") : "No audio"}
            </Text>

            {audioError ? <Text style={styles.errorText}>{audioError}</Text> : null}
          </View>
        </View>

        {/* Action row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionPill} onPress={onCopy}>
            <Icon name="copy-outline" size={18} color="#111" />
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionPill} onPress={onShare}>
            <Icon name="share-social-outline" size={18} color="#111" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionPill} onPress={openScore}>
            <Icon name="book-outline" size={18} color="#111" />
            <Text style={styles.actionText}>Score</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentWrap}>
        {loadingLang ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.light.primary} />
            <Text style={styles.loadingText}>Loading hymn…</Text>
          </View>
        ) : notAvailable ? (
          <View style={styles.notAvailCard}>
            <Icon name="alert-circle-outline" size={34} color={COLORS.light.primary} />
            <Text style={styles.notAvailTitle}>Not available</Text>
            <Text style={styles.notAvailText}>
              This hymn does not exist in the selected language.
            </Text>

            <TouchableOpacity style={styles.notAvailBtn} onPress={() => setLangPickerVisible(true)}>
              <Text style={styles.notAvailBtnText}>Choose another language</Text>
              <Icon name="chevron-forward" size={18} color="#111" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webCard}>
            <WebView
              source={{ html: htmlContent }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              scalesPageToFit={false}
              style={styles.webView}
            />
          </View>
        )}
      </View>

      {/* Language picker modal */}
      <Modal visible={langPickerVisible} animationType="slide" transparent onRequestClose={() => setLangPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Choose language</Text>

          <View style={styles.sheetList}>
            {LANGS.map((l) => {
              const active = selectedLang === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.sheetItem, active && styles.sheetItemActive]}
                  onPress={() => {
                    setLangPickerVisible(false);
                    setSelectedLang(l.code);
                  }}
                >
                  <View style={styles.sheetItemLeft}>
                    <View style={[styles.langDot, active && { backgroundColor: COLORS.light.primary }]} />
                    <Text style={styles.sheetItemText}>{l.fallback}</Text>
                  </View>
                  {active ? <Icon name="checkmark" size={20} color={COLORS.light.primary} /> : <Icon name="chevron-forward" size={18} color="#999" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Score modal */}
      <Modal visible={scoreVisible} animationType="fade" transparent onRequestClose={() => setScoreVisible(false)}>
        <View style={styles.scoreBackdrop}>
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTitle}>Hymn Score</Text>
              <TouchableOpacity onPress={() => setScoreVisible(false)} style={styles.scoreCloseBtn}>
                <Icon name="close" size={20} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.scoreBody}>
              {current?.scoreUrl ? (
                <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                  <Image
                    source={{ uri: current.scoreUrl }}
                    style={styles.scoreImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              ) : (
                <WebView
                  source={{
                    html: `
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                          <style>
                            body{font-family:Arial; padding:12px; font-size:16px; color:#222;}
                          </style>
                        </head>
                        <body>${current?.scoreHtml || "<p>No scoring available.</p>"}</body>
                      </html>
                    `,
                  }}
                  originWhitelist={["*"]}
                  style={{ flex: 1 }}
                />
              )}
            </View>

            <View style={styles.scoreFooter}>
              <TouchableOpacity style={styles.scoreActionBtn} onPress={onShare}>
                <Icon name="share-social-outline" size={18} color="#111" />
                <Text style={styles.scoreActionText}>Share hymn</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.scoreActionBtn, { backgroundColor: COLORS.light.primary }]} onPress={() => setScoreVisible(false)}>
                <Icon name="checkmark" size={18} color="#fff" />
                <Text style={[styles.scoreActionText, { color: "#fff" }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },

  headerWrap: {
    paddingTop: Platform.select({ ios: 52, android: 16 }),
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 46,
    height: 46,
    resizeMode: "contain",
  },

  heroCard: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FBFBFB",
    borderWidth: 1,
    borderColor: "#F1F1F1",
  },

  heroLeft: { flex: 1, paddingRight: 10 },
  heroRight: { width: 110, alignItems: "center", justifyContent: "center" },

  heroNumber: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.light.primary,
    marginBottom: 6,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    lineHeight: 22,
    marginBottom: 10,
  },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  metaChipText: { fontSize: 12.5, color: "#333", fontWeight: "600" },

  primaryPlayBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.light.primary,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  playLabel: { marginTop: 8, fontSize: 12.5, color: "#444", fontWeight: "700" },
  errorText: { marginTop: 4, fontSize: 11, color: "#D32F2F", textAlign: "center" },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  actionPill: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
  },

  actionText: { fontSize: 13.5, fontWeight: "700", color: "#111" },

  contentWrap: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18 },

  webCard: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F1F1",
    backgroundColor: "#fff",
  },

  webView: { flex: 1, backgroundColor: "#fff" },

  loadingBox: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBFBFB",
  },

  loadingText: { marginTop: 10, color: "#444", fontWeight: "700" },

  notAvailCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    backgroundColor: "#FBFBFB",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  notAvailTitle: { marginTop: 10, fontSize: 18, fontWeight: "800", color: "#111" },
  notAvailText: { marginTop: 6, fontSize: 13.5, color: "#555", textAlign: "center", lineHeight: 20 },

  notAvailBtn: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
  },
  notAvailBtnText: { fontSize: 13.5, fontWeight: "800", color: "#111" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },

  sheetHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E6E6E6",
    alignSelf: "center",
    marginBottom: 10,
  },

  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#111", marginBottom: 10 },

  sheetList: { gap: 10 },

  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F7F7F7",
  },

  sheetItemActive: {
    backgroundColor: "#F2FBFB",
    borderWidth: 1,
    borderColor: "rgba(47,165,169,0.28)",
  },

  sheetItemLeft: { flexDirection: "row", alignItems: "center", gap: 10 },

  langDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#DADADA",
  },

  sheetItemText: { fontSize: 14.5, fontWeight: "800", color: "#111" },

  scoreBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  scoreCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F1F1",
    minHeight: 360,
    maxHeight: "85%",
  },

  scoreHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  scoreTitle: { fontSize: 16, fontWeight: "900", color: "#111" },

  scoreCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
  },

  scoreBody: { flex: 1, backgroundColor: "#fff" },

  scoreImage: { width: "100%", height: 520 },

  scoreFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    flexDirection: "row",
    gap: 10,
  },

  scoreActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  scoreActionText: { fontSize: 13.5, fontWeight: "900", color: "#111" },
});

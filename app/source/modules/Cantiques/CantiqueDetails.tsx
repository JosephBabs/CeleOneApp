import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";
import { WebView } from "react-native-webview";

interface RouteParams {
  cantique: any;
}

export default function CantiqueDetails({ route, navigation }: any) {
  const { cantique }: RouteParams = route.params;
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    setPlaying(!playing);
    // Here you would integrate audio playback logic
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 16px;
          margin: 0;
          background-color: #fff;
          color: #333;
          font-size: 22px;
          line-height: 1.5;
          overflox: scroll;
        }
        p { margin: 8px 0; line-height: 1.5; }
        h3 { color: #333; margin: 16px 0 8px 0; }
        strong { font-weight: bold; }
        em { font-style: italic; }
        ul, ol { margin: 8px 0; padding-left: 20px; }
        li { margin: 4px 0; }
        blockquote {
          border-left: 4px solid #ddd;
          padding-left: 16px;
          margin: 16px 0;
          color: #666;
        }
      </style>
    </head>
    <body>
      ${cantique.hymnContent || "No content available"}
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styless.header1}>
        <Image source={d_assets.images.appLogo} style={styless.logo} />
        <Text style={styles.headerTitle}>{cantique.hymnNumber}</Text>
        <View style={styless.headerIcons}>
          <TouchableOpacity onPress={handlePlay}>
              <Icon
                name={playing ? "pause-circle" : "play-circle"}
                size={40}
                color={COLORS.light.primary}
              />
            </TouchableOpacity>
        </View>
      </View>
      
        <View style={{ flex: 1, marginBottom: 20, paddingHorizontal: 20 }}>
          <WebView
            source={{ html: htmlContent }}
            style={styles.webView}
            originWhitelist={['*']}
            scalesPageToFit={false}
            scrollEnabled={true}
            javaScriptEnabled={true}
            
            domStorageEnabled={true}
          />
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.light.primary,
  },
  hymnCard: {
    backgroundColor: "#fff",
    elevation: 0.4,
    // flex:1,
    padding: 16,
    // marginVertical: 8,
    marginHorizontal: 20,
    borderRadius: 8,
  },
  hymnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    // marginBottom: 16,
  },
  hymnTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333",
  },
  hymnSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  hymnContent: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    flex: 1,
  },
  webView: {
    height: 620,
    overflow: 'scroll',
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
});

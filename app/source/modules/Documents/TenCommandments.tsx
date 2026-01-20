import React from "react";
import { Text, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../core/theme/colors";

export default function TenCommandments() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t("doc_10_commandments")}</Text>
      <Text style={styles.content}>
        Content for the 10 Commandments goes here. This is a placeholder text.
        In a real implementation, this would contain the actual document content.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.light.primary,
    marginBottom: 16,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
});

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onSelectLanguage: (lng: string) => void;
};

export default function LanguageSelectModal({ visible, onSelectLanguage }: Props) {
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalContent}>
          <Text style={styles.title}>{t('settings.selectLanguage')}</Text>
          {['en', 'fr', 'yo', 'gou', 'es'].map((lng) => (
            <Pressable key={lng} style={styles.languageItem} onPress={() => onSelectLanguage(lng)}>
              <Text style={styles.languageText}>{t(`lang.${lng}`)}</Text>
            </Pressable>
          ))}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  languageItem: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#ddd' },
  languageText: { fontSize: 18, textAlign: 'center' },
});

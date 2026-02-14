import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../core/theme/colors';
import Icon from 'react-native-vector-icons/Ionicons';
import styless from '../../../../styles';
import { d_assets } from '../../configs/assets';

export default function Cantiques({ navigation }: any) {
  const { t } = useTranslation();

  // Build list with translated labels
  const cantiqueItems = useMemo(
    () => [
      { key: 'cantique_goun', label: t('cantiques.en_gou'), screen: 'CantiqueGoun', chip: t('cantiques.tag_gou') },
      { key: 'cantique_yoruba', label: t('cantiques.en_yo'), screen: 'CantiqueYoruba', chip: t('cantiques.tag_yo') },
      { key: 'cantique_francais', label: t('cantiques.en_fr'), screen: 'CantiqueFrancais', chip: t('cantiques.tag_fr') },
      { key: 'cantique_anglais', label: t('cantiques.en_en'), screen: 'CantiqueAnglais', chip: t('cantiques.tag_en') },
    ],
    [t],
  );

  const [queryText, setQueryText] = useState('');

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return cantiqueItems;
    return cantiqueItems.filter(x => {
      const label = (x.label || '').toLowerCase();
      const chip = (x.chip || '').toLowerCase();
      return label.includes(q) || chip.includes(q);
    });
  }, [queryText, cantiqueItems]);

  const handleOpenCantique = (screen: string) => navigation.navigate(screen);

  const renderItem = ({ item }: any) => (
    <Pressable
      onPress={() => handleOpenCantique(item.screen)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconWrap}>
          <Icon name="musical-notes-outline" size={22} color={COLORS.light.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.label}
            </Text>

            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.chip}</Text>
            </View>
          </View>

          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {t('cantiques.subtitle') || 'Choose a language to browse the hymn book.'}
          </Text>
        </View>
      </View>

      <View style={styles.openPill}>
        <Text style={styles.openPillText}>{t('cantiques.open') || 'Open'}</Text>
        <Icon name="chevron-forward" size={16} color="#111" />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header (same “settings” vibe) */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Image source={d_assets.images.appLogo} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>{t('cantiques.title')}</Text>
            <Text style={styles.headerSub}>
              {filtered.length}/{cantiqueItems.length} {t('cantiques.items') || 'books'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerIconBtn}
            activeOpacity={0.9}
          >
            <Icon name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerIconBtn}
            activeOpacity={0.9}
          >
            <Icon name="settings-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={18} color="#777" />
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          placeholder={t('cantiques.searchPlaceholder') || 'Search cantiques...'}
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
        {!!queryText.trim() && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setQueryText('')} activeOpacity={0.9}>
            <Icon name="close" size={16} color="#111" />
          </TouchableOpacity>
        )}
      </View>

      {/* Small hint card */}
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Icon name="information-circle-outline" size={18} color={COLORS.light.primary} />
        </View>
        <Text style={styles.infoText}>
          {t('cantiques.tip') || 'Tip: Use search to quickly find your preferred language.'}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="musical-notes-outline" size={26} color="#999" />
            </View>
            <Text style={styles.emptyTitle}>{t('cantiques.noResults') || 'No results'}</Text>
            <Text style={styles.emptySub}>{t('cantiques.tryAnotherSearch') || 'Try another keyword.'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 38, height: 38, borderRadius: 14 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  headerSub: { marginTop: 3, fontSize: 12.5, fontWeight: '800', color: '#7A7A7A' },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#F2F3F5',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#111' },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info
  infoCard: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(46,204,113,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12.8,
    fontWeight: '800',
    color: '#2D2D2D',
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', flex: 1 },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: '900', color: '#111' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
  },
  chipText: { fontSize: 11.5, fontWeight: '900', color: '#444' },

  cardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  openPill: {
    marginLeft: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  openPillText: { fontSize: 12.5, fontWeight: '900', color: '#111' },

  // Empty
  emptyState: { paddingVertical: 50, alignItems: 'center' },
  emptyIcon: {
    width: 64,
    height: 64, 
    borderRadius: 22,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: '#111' },
  emptySub: { marginTop: 6, fontSize: 13.5, fontWeight: '700', color: '#777' },
});

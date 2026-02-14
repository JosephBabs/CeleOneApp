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
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../../core/theme/colors';
import styless from '../../../../styles';
import { d_assets } from '../../configs/assets';

// document keys
const documentKeys = [
  'doc_10_commandments',
  'doc_church_history',
  'doc_osh_offa',
  'doc_constitution',
  'doc_light_on_ecc',
  'doc_11_ordnances',
  'doc_4_sacraments',
  'doc_12_forbidden',
  'doc_institutions',
];

// Mapping from docKey to screen name
const docKeyToScreen: Record<string, string> = {
  doc_10_commandments: 'TenCommandments',
  doc_church_history: 'ChurchHistory',
  doc_osh_offa: 'OshOffa',
  doc_constitution: 'Constitution',
  doc_light_on_ecc: 'LightOnEcc',
  doc_11_ordnances: 'ElevenOrdinances',
  doc_4_sacraments: 'FourSacraments',
  doc_12_forbidden: 'TwelveForbidden',
  doc_institutions: 'Institutions',
};

// Optional: give each document its own icon + small chip label
const docMeta: Record<
  string,
  { icon: string; chip: string; accent?: string; descriptionKey?: string }
> = {
  doc_10_commandments: {
    icon: 'ribbon-outline',
    chip: 'Essentials',
    descriptionKey: 'documents.desc_10_commandments',
  },
  doc_church_history: {
    icon: 'time-outline',
    chip: 'History',
    descriptionKey: 'documents.desc_church_history',
  },
  doc_osh_offa: {
    icon: 'person-outline',
    chip: 'Founder',
    descriptionKey: 'documents.desc_osh_offa',
  },
  doc_constitution: {
    icon: 'book-outline',
    chip: 'Rules',
    descriptionKey: 'documents.desc_constitution',
  },
  doc_light_on_ecc: {
    icon: 'sunny-outline',
    chip: 'Teaching',
    descriptionKey: 'documents.desc_light_on_ecc',
  },
  doc_11_ordnances: {
    icon: 'list-outline',
    chip: 'Doctrine',
    descriptionKey: 'documents.desc_11_ordnances',
  },
  doc_4_sacraments: {
    icon: 'water-outline',
    chip: 'Sacraments',
    descriptionKey: 'documents.desc_4_sacraments',
  },
  doc_12_forbidden: {
    icon: 'close-circle-outline',
    chip: 'Guidance',
    descriptionKey: 'documents.desc_12_forbidden',
  },
  doc_institutions: {
    icon: 'business-outline',
    chip: 'Institutions',
    descriptionKey: 'documents.desc_institutions',
  },
};

export default function DocumentsScreen({ navigation }: any) {
  const { t } = useTranslation();

  const [queryText, setQueryText] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const handleOpenDocument = (key: string) => {
    const screenName = docKeyToScreen[key];
    if (screenName) navigation.navigate(screenName);
  };

  const filteredDocs = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return documentKeys;

    return documentKeys.filter(k => {
      const title = t(k).toLowerCase();
      const meta = docMeta[k];
      const chip = (meta?.chip || '').toLowerCase();
      const desc = meta?.descriptionKey
        ? t(meta.descriptionKey).toLowerCase()
        : '';
      return title.includes(q) || chip.includes(q) || desc.includes(q);
    });
  }, [queryText, t]);

  const totalCount = documentKeys.length;
  const filteredCount = filteredDocs.length;

  const renderItem = ({ item }: { item: string }) => {
    const meta = docMeta[item] || {
      icon: 'document-text-outline',
      chip: 'Document',
    };
    const title = t(item);

    const desc =
      meta.descriptionKey && t(meta.descriptionKey) !== meta.descriptionKey
        ? t(meta.descriptionKey)
        : '';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          viewMode === 'grid' && styles.cardGrid,
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
        onPress={() => handleOpenDocument(item)}
      >
        <View style={styles.cardLeft}>
          <View style={styles.iconWrap}>
            <Icon
              name={meta.icon as any}
              size={22}
              color={COLORS.light.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {title}
              </Text>

              
            </View>

            {!!desc && (
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {desc}
              </Text>
            )}
          </View>
        </View>

        {viewMode === 'list' && (
          <View style={styles.cardRight}>
            <View style={styles.openPill}>
              <Text style={styles.openPillText}>
                {t('documents.open') || 'Open'}
              </Text>
              <Icon name="chevron-forward" size={16} color="#111" />
            </View>
          </View>
        )}

        {viewMode === 'grid' && (
          <View style={styles.gridChevron}>
            <Icon
              name="arrow-forward-circle"
              size={22}
              color={COLORS.light.primary}
            />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header (same premium settings style) */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Image source={d_assets.images.appLogo} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>{t('documents.title')}</Text>
            <Text style={styles.headerSub}>
              {filteredCount}/{totalCount} {t('documents.items') || 'documents'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              setViewMode(prev => (prev === 'list' ? 'grid' : 'list'))
            }
            activeOpacity={0.9}
          >
            <Icon
              name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
              size={20}
              color="#111"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.9}
          >
            <Icon name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Settings')}
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
          placeholder={
            t('documents.searchPlaceholder') || 'Search documents...'
          }
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
        {!!queryText.trim() && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setQueryText('')}
            activeOpacity={0.9}
          >
            <Icon name="close" size={16} color="#111" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Filter Chips */}
      <View style={styles.chipsRow}>
        {[
          { label: t('documents.filter_all'), value: '' },
          { label: t('documents.filter_essentials'), value: 'essentials' },
          { label: t('documents.filter_history'), value: 'history' },
          { label: t('documents.filter_rules'), value: 'rules' },
        ].map(ch => (
          <TouchableOpacity
            key={ch.label}
            style={[
              styles.filterChip,
              (ch.value === '' && queryText === '') ||
              (ch.value !== '' && queryText.toLowerCase() === ch.value)
                ? styles.filterChipActive
                : null,
            ]}
            onPress={() => setQueryText(ch.value)}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.filterChipText,
                (ch.value === '' && queryText === '') ||
                (ch.value !== '' && queryText.toLowerCase() === ch.value)
                  ? styles.filterChipTextActive
                  : null,
              ]}
            >
              {ch.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredDocs}
        keyExtractor={item => item}
        renderItem={renderItem}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // force re-layout when switching list/grid
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          paddingTop: 10,
        }}
        columnWrapperStyle={viewMode === 'grid' ? { gap: 12 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="document-text-outline" size={28} color="#999" />
            </View>
            <Text style={styles.emptyTitle}>
              {t('documents.noResults') || 'No results'}
            </Text>
            <Text style={styles.emptySub}>
              {t('documents.tryAnotherSearch') || 'Try another keyword.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header (settings style)
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
  headerSub: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#7A7A7A',
  },

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

  // Quick chips
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
  },
  filterChipActive: {
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.30)',
  },
  filterChipText: { fontSize: 12.5, fontWeight: '900', color: '#666' },
  filterChipTextActive: { color: COLORS.light.primary },

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
  cardGrid: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    minHeight: 140,
  },
  cardLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    flex: 1,
  },
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

  cardRight: { marginLeft: 10 },
  openPill: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  openPillText: { fontSize: 12.5, fontWeight: '900', color: '#111' },

  gridChevron: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },

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

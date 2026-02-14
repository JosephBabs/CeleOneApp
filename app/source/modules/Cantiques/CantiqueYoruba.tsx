import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../../core/theme/colors';
// import styless from '../../../../styles';
import { d_assets } from '../../configs/assets';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../auth/firebaseConfig';
import { useTranslation } from 'react-i18next';

interface Cantique {
  id: string;
  title: string;
  hymnNumber: number;
  musicalKey?: string;
  hymnContent: string;
  language: string;
  createdAt: any;
}

interface Group {
  start: number;
  end: number;
  hymns: Cantique[];
}

export default function CantiqueYoruba({ navigation }: any) {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [cantiques, setCantiques] = useState<Cantique[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // default: open first group to feel alive
  const [groupStates, setGroupStates] = useState<boolean[]>([true]);

  useEffect(() => {
    fetchCantiques();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCantiques = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'cantiques'), where('language', '==', 'yoruba'));
      const snapshot = await getDocs(q);

      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Cantique))
        .sort((a, b) => (a.hymnNumber || 0) - (b.hymnNumber || 0));

      setCantiques(data);
    } catch (e) {
      console.error('Error fetching cantiques:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleHymnPress = (cantique: Cantique) => {
    navigation.navigate('CantiqueDetails', { cantique });
  };

  const filteredCantiques = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cantiques;

    return cantiques.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.hymnNumber || '').toString().includes(q) ||
      (c.musicalKey || '').toLowerCase().includes(q),
    );
  }, [cantiques, searchQuery]);

  const groups: Group[] = useMemo(() => {
    const groupsArray: Group[] = [];
    const groupSize = 42;

    let currentGroupStart = 1;
    let currentGroupHymns: Cantique[] = [];

    for (const cantique of filteredCantiques) {
      if (
        cantique.hymnNumber >= currentGroupStart &&
        cantique.hymnNumber < currentGroupStart + groupSize
      ) {
        currentGroupHymns.push(cantique);
      } else {
        if (currentGroupHymns.length > 0) {
          groupsArray.push({
            start: currentGroupStart,
            end: currentGroupStart + groupSize - 1,
            hymns: currentGroupHymns,
          });
        }

        currentGroupStart =
          Math.floor((cantique.hymnNumber - 1) / groupSize) * groupSize + 1;
        currentGroupHymns = [cantique];
      }
    }

    if (currentGroupHymns.length > 0) {
      groupsArray.push({
        start: currentGroupStart,
        end: currentGroupStart + groupSize - 1,
        hymns: currentGroupHymns,
      });
    }

    return groupsArray;
  }, [filteredCantiques]);

  // keep groupStates length in sync with groups length
  useEffect(() => {
    setGroupStates(prev => {
      const next = [...prev];
      while (next.length < groups.length) next.push(false);
      return next.slice(0, groups.length);
    });
  }, [groups.length]);

  const toggleGroup = (index: number) => {
    setGroupStates(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const sections = useMemo(() => {
    return groups.map((group, index) => ({
      title: `${group.start}-${group.end}`,
      data: groupStates[index] ? group.hymns : [],
      groupIndex: index,
      group,
    }));
  }, [groups, groupStates]);

  const renderCantiqueCard = ({ item }: { item: Cantique }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.listCard}
      onPress={() => handleHymnPress(item)}
    >
      <View style={styles.listLeft}>
        <View style={styles.numPill}>
          <Text style={styles.numPillText}>{item.hymnNumber}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title || t('cantiques.hymn_untitled')}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Icon name="musical-note-outline" size={14} color="#666" />
              <Text style={styles.metaChipText}>
                {t('cantiques.key_label')}{' '}
                {item.musicalKey ? item.musicalKey : t('cantiques.key_none')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.openPill}>
        <Text style={styles.openPillText}>{t('cantiques.open')}</Text>
        <Icon name="chevron-forward" size={16} color="#111" />
      </View>
    </TouchableOpacity>
  );

  const renderHymnButton = (hymn: Cantique) => (
    <TouchableOpacity
      key={hymn.id}
      activeOpacity={0.9}
      style={styles.hymnButton}
      onPress={() => handleHymnPress(hymn)}
    >
      <Text style={styles.hymnText}>{hymn.hymnNumber}</Text>
    </TouchableOpacity>
  );

  const Header = (
    <>
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Image source={d_assets.images.appLogo} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>{t('cantiques.yoruba_title')}</Text>
            <Text style={styles.headerSub}>
              {filteredCantiques.length} {t('cantiques.hymns')}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            style={styles.headerIconBtn}
            activeOpacity={0.9}
          >
            <Icon
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color="#111"
            />
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

      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={18} color="#777" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('cantiques.search_hymns_placeholder')}
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
        {!!searchQuery.trim() && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setSearchQuery('')}
            activeOpacity={0.9}
          >
            <Icon name="close" size={16} color="#111" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.modeRow}>
        <View style={styles.modeChip}>
          <Icon name="language-outline" size={14} color="#666" />
          <Text style={styles.modeChipText}>{t('cantiques.lang_yoruba')}</Text>
        </View>

        <View style={styles.modeChip}>
          <Icon name="layers-outline" size={14} color="#666" />
          <Text style={styles.modeChipText}>
            {viewMode === 'grid' ? t('cantiques.view_grid') : t('cantiques.view_list')}
          </Text>
        </View>
      </View>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {Header}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
          <Text style={styles.loadingText}>{t('cantiques.loading_hymns')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {viewMode === 'list' ? (
        <FlatList
          ListHeaderComponent={Header}
          data={filteredCantiques}
          keyExtractor={item => item.id}
          renderItem={renderCantiqueCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="musical-notes-outline" size={26} color="#999" />
              </View>
              <Text style={styles.emptyTitle}>{t('cantiques.no_hymns_found')}</Text>
              <Text style={styles.emptySub}>{t('cantiques.try_another_search')}</Text>
            </View>
          }
        />
      ) : (
        <SectionList
          ListHeaderComponent={Header}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.groupCard}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.groupHeader}
                onPress={() => toggleGroup(section.groupIndex)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{section.title}</Text>
                  </View>

                  <Text style={styles.groupCountText}>
                    {section.group.hymns.length} {t('cantiques.hymns')}
                  </Text>
                </View>

                <Icon
                  name={groupStates[section.groupIndex] ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#111"
                />
              </TouchableOpacity>

              {section.data.length > 0 && (
                <View style={styles.gridContainer}>
                  {section.data.map(h => renderHymnButton(h))}
                </View>
              )}
            </View>
          )}
          renderItem={() => null}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="musical-notes-outline" size={26} color="#999" />
              </View>
              <Text style={styles.emptyTitle}>{t('cantiques.no_hymns_found')}</Text>
              <Text style={styles.emptySub}>{t('cantiques.try_another_search')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header bar (same “settings” style)
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

  // Search (pill)
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

  // Mode chips row
  modeRow: {
    marginTop: 10,
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modeChipText: { fontSize: 12.5, fontWeight: '900', color: '#444' },

  // Loading
  loadingBox: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 12, fontSize: 13.5, fontWeight: '800', color: '#666' },

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

  // LIST CARD
  listCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  numPill: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numPillText: { fontSize: 16, fontWeight: '900', color: '#111' },
  listTitle: { fontSize: 15.5, fontWeight: '900', color: '#111' },
  metaRow: { marginTop: 6, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 12, fontWeight: '800', color: '#444' },

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

  // GROUP CARD
  groupCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 18,
    overflow: 'hidden',
  },
  groupHeader: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
  },
  groupBadgeText: { fontSize: 12.5, fontWeight: '900', color: '#111' },
  groupCountText: { fontSize: 12.5, fontWeight: '800', color: '#666' },

  // GRID
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  hymnButton: {
    width: 54,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: '#F8F9FB',
  },
  hymnText: { fontSize: 13.5, fontWeight: '900', color: '#111' },
});

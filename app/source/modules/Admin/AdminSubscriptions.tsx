// AdminSubscriptions.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../core/theme/colors';
import { db } from '../auth/firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import useAdminEnglish from '../../../../src/hooks/useAdminEnglish';

type Filter = 'all' | 'active' | 'expired' | 'cancelled';

export default function AdminSubscriptions({ navigation }: any) {
  const { t } = useTranslation();
  useAdminEnglish();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [subsMap, setSubsMap] = useState<Record<string, any>>({});
  const [packages, setPackages] = useState<any[]>([]);

  const [filter, setFilter] = useState<Filter>('all');
  const [qText, setQText] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [startAt, setStartAt] = useState(String(Date.now()));
  const [status, setStatus] = useState<Filter>('active');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [uSnap, pSnap, sSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'user_data'),
            orderBy('createdAt', 'desc'),
            limit(300),
          ),
        ),
        getDocs(
          query(
            collection(db, 'subscription_packages'),
            orderBy('createdAt', 'desc'),
          ),
        ),
        getDocs(
          query(
            collection(db, 'user_subscriptions'),
            orderBy('updatedAt', 'desc'),
            limit(300),
          ),
        ),
      ]);

      const u = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const p = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const s = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const map: Record<string, any> = {};
      for (const it of s) map[it.uid] = it;

      setUsers(u);
      setPackages(p);
      setSubsMap(map);
    } catch (e: any) {
      Alert.alert(t('adminSubscriptions.title'), e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const text = qText.trim().toLowerCase();
    let list = [...users];

    if (text) {
      list = list.filter(u => {
        const full = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = String(u.email || '').toLowerCase();
        return full.includes(text) || email.includes(text);
      });
    }

    if (filter !== 'all') {
      list = list.filter(u => {
        const sub = subsMap[u.id];
        const st = String(sub?.status || '');
        return st === filter;
      });
    }

    return list;
  }, [users, qText, filter, subsMap]);

//   const openAssign = (user: any) => {
//     setSelectedUser(user);
//     setSelectedPackageId('');
//     setStartAt(String(Date.now()));
//     setStatus('active');
//     setAssignOpen(true);
//   };

const openAssign = (user: any) => {
  const sub = subsMap[user.id];

  setSelectedUser(user);

  // ✅ If user has an ACTIVE subscription, preselect it
  if (sub && String(sub.status) === "active" && sub.packageId) {
    setSelectedPackageId(String(sub.packageId));
  } else {
    setSelectedPackageId("");
  }

  // ✅ Pre-fill startAt if exists, else now
  setStartAt(String(sub?.startAt ? Number(sub.startAt) : Date.now()));

  // ✅ Pre-fill status if exists
  const st = String(sub?.status || "active") as Filter;
  setStatus(st === "all" ? "active" : st);

  setAssignOpen(true);
};


  const saveAssign = async () => {
    if (!selectedUser || !selectedPackageId) return;

    const pkg = packages.find(p => p.id === selectedPackageId);
    if (!pkg) return;

    try {
      const start = Number(startAt || Date.now());
      const end = start + Number(pkg.durationDays || 0) * 24 * 60 * 60 * 1000;

      await setDoc(
        doc(db, 'user_subscriptions', selectedUser.id),
        {
          uid: selectedUser.id,
          packageId: pkg.id,
          packageName: pkg.name,
          price: Number(pkg.price || 0),
          startAt: start,
          endAt: end,
          status: status === 'all' ? 'active' : status,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setAssignOpen(false);
      await load();
      Alert.alert(t('adminSubscriptions.title'), t('adminSubscriptions.saved'));
    } catch (e: any) {
      Alert.alert(t('adminSubscriptions.title'), e?.message || 'Error');
    }
  };

  const updateSubStatus = async (
    uid: string,
    nextStatus: Filter,
    extra?: any,
  ) => {
    try {
      await setDoc(
        doc(db, 'user_subscriptions', uid),
        {
          uid,
          status: nextStatus === 'all' ? 'active' : nextStatus,
          updatedAt: serverTimestamp(),
          ...(extra || {}),
        },
        { merge: true },
      );

      await load();
      Alert.alert(t('adminSubscriptions.title'), t('adminSubscriptions.saved'));
    } catch (e: any) {
      Alert.alert(
        t('adminSubscriptions.title'),
        e?.message || t('adminSubscriptions.errors.generic'),
      );
    }
  };

  const activateSub = (user: any) => {
    Alert.alert(
      t('adminSubscriptions.confirm.activateTitle'),
      t('adminSubscriptions.confirm.activateMessage'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: t('adminSubscriptions.actions.activate'),
          onPress: () => updateSubStatus(user.id, 'active'),
        },
      ],
    );
  };

  const deactivateSub = (user: any) => {
    Alert.alert(
      t('adminSubscriptions.confirm.deactivateTitle'),
      t('adminSubscriptions.confirm.deactivateMessage'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: t('adminSubscriptions.actions.deactivate'),
          style: 'destructive',
          onPress: () => updateSubStatus(user.id, 'cancelled'),
        },
      ],
    );
  };

  const endSubNow = (user: any) => {
    Alert.alert(
      t('adminSubscriptions.confirm.endTitle'),
      t('adminSubscriptions.confirm.endMessage'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: t('adminSubscriptions.actions.endNow'),
          style: 'destructive',
          onPress: () =>
            updateSubStatus(user.id, 'expired', {
              endAt: Date.now(),
            }),
        },
      ],
    );
  };

  const prettyStatus = (sub: any) => {
    const st = String(sub?.status || '');
    if (st === 'active') return t('adminSubscriptions.status.active');
    if (st === 'expired') return t('adminSubscriptions.status.expired');
    if (st === 'cancelled') return t('adminSubscriptions.status.cancelled');
    return '—';
  };

  const renderUser = ({ item }: any) => {
    const sub = subsMap[item.id];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openAssign(item)}
        activeOpacity={0.92}
      >
        <View style={styles.cardLeft}>
          <View style={styles.avatarFallback}>
            <Icon name="card-outline" size={20} color={COLORS.light.primary} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.name} numberOfLines={1}>
              {item.firstName || ''} {item.lastName || ''}
            </Text>

            <View
              style={[
                styles.badgePill,
                { backgroundColor: 'rgba(59,130,246,0.14)' },
              ]}
            >
              <Text
                style={[styles.badgeText, { color: '#1D4ED8' }]}
                numberOfLines={1}
              >
                {prettyStatus(sub)}
              </Text>
            </View>
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {item.email || ''}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              {t('adminSubscriptions.package')}: {sub?.packageName || '—'} ·{' '}
              {t('adminSubscriptions.endAt')}:{' '}
              {sub?.endAt ? new Date(sub.endAt).toLocaleDateString() : '—'}
            </Text>
          </View>
        </View>

        <Icon name="chevron-forward" size={18} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {t('adminSubscriptions.title')}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {t('adminSubscriptions.subtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={16} color="rgba(255,255,255,0.75)" />
          <TextInput
            value={qText}
            onChangeText={setQText}
            placeholder={t('adminSubscriptions.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.pills}>
          <Pill
            label={t('common.all')}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Pill
            label={t('adminSubscriptions.status.active')}
            active={filter === 'active'}
            onPress={() => setFilter('active')}
          />
          <Pill
            label={t('adminSubscriptions.status.expired')}
            active={filter === 'expired'}
            onPress={() => setFilter('expired')}
          />
          <Pill
            label={t('adminSubscriptions.status.cancelled')}
            active={filter === 'cancelled'}
            onPress={() => setFilter('cancelled')}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={it => it.id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ASSIGN MODAL */}
      <Modal
        visible={assignOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {t('adminSubscriptions.assign')}
                    </Text>
                    <Text style={styles.modalSub}>
                      {selectedUser
                        ? `${selectedUser.firstName || ''} ${
                            selectedUser.lastName || ''
                          }`
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAssignOpen(false)}
                    style={styles.modalCloseBtn}
                  >
                    <Icon name="close" size={18} color="#111" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>
                  {t('adminSubscriptions.package')}
                </Text>
                {packages.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPackageId(p.id)}
                    style={[
                      styles.pickRow,
                      selectedPackageId === p.id && {
                        borderColor: 'rgba(47,165,169,0.45)',
                      },
                    ]}
                    activeOpacity={0.9}
                  >
                    <View style={styles.roomIcon}>
                      <Icon name="pricetag-outline" size={18} color="#111" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{p.name}</Text>
                      <Text style={styles.roomSub}>
                        {t('adminPackages.price')}: {p.price} ·{' '}
                        {t('adminPackages.durationDays')}: {p.durationDays}
                      </Text>
                    </View>
                    {selectedPackageId === p.id ? (
                      <Icon
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.light.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                ))}

                <View style={styles.divider} />

                <Field
                  label={t('adminSubscriptions.startAt')}
                  value={startAt}
                  onChangeText={setStartAt}
                  keyboardType="numeric"
                />

                <Text style={styles.sectionTitle}>
                  {t('adminSubscriptions.setStatus')}
                </Text>
                <View style={styles.pills}>
                  <Pill
                    label={t('adminSubscriptions.status.active')}
                    active={status === 'active'}
                    onPress={() => setStatus('active')}
                  />
                  <Pill
                    label={t('adminSubscriptions.status.expired')}
                    active={status === 'expired'}
                    onPress={() => setStatus('expired')}
                  />
                  <Pill
                    label={t('adminSubscriptions.status.cancelled')}
                    active={status === 'cancelled'}
                    onPress={() => setStatus('cancelled')}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.grayBtn, { flex: 1 }]}
                    onPress={() => selectedUser && activateSub(selectedUser)}
                    disabled={!selectedUser}
                  >
                    <Icon
                      name="checkmark-circle-outline"
                      size={18}
                      color="#111"
                    />
                    <Text style={styles.grayBtnText}>
                      {t('adminSubscriptions.actions.activate')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.grayBtn, { flex: 1 }]}
                    onPress={() => selectedUser && deactivateSub(selectedUser)}
                    disabled={!selectedUser}
                  >
                    <Icon name="ban-outline" size={18} color="#111" />
                    <Text style={styles.grayBtnText}>
                      {t('adminSubscriptions.actions.deactivate')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => selectedUser && endSubNow(selectedUser)}
                  disabled={!selectedUser}
                >
                  <Icon name="time-outline" size={18} color="#fff" />
                  <Text style={styles.dangerBtnText}>
                    {t('adminSubscriptions.actions.endNow')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={saveAssign}
                >
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t('common.save')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => setAssignOpen(false)}
                >
                  <Text style={styles.linkText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
        </View>
      </Modal>
    </View>
  );
}

function Pill({ label, active, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F5F7' },

  hero: {
    backgroundColor: '#0E0E10',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grayBtn: {
  backgroundColor: "#F3F4F6",
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 12,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "#EEF0F3",
},
grayBtnText: { fontWeight: "900", color: "#111" },

dangerBtn: {
  marginTop: 10,
  backgroundColor: "#EF4444",
  borderRadius: 16,
  paddingVertical: 14,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
},
dangerBtnText: { color: "#fff", fontWeight: "900" }
,
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 12.5,
  },

  searchRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontWeight: '800' },

  pills: { marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillActive: { backgroundColor: '#fff' },
  pillText: {
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '900',
    fontSize: 12,
  },
  pillTextActive: { color: '#111' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF0F3',
  },
  cardLeft: { width: 54, height: 54 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(47,165,169,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: { fontSize: 15.5, fontWeight: '900', color: '#111', flex: 1 },
  email: { marginTop: 6, fontSize: 12.5, color: '#6B6B70', fontWeight: '700' },
  metaRow: { marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '800', color: '#6B6B70' },
  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 10.5, fontWeight: '900' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  modalSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B6B70',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: '#EEF0F3', marginVertical: 14 },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#111',
    marginBottom: 10,
  },

  label: { fontSize: 12, fontWeight: '900', color: '#111', marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },

  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomName: { fontSize: 13.5, fontWeight: '900', color: '#111' },
  roomSub: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#6B6B70' },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: '#fff', fontWeight: '900' },
  linkBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  linkText: { color: COLORS.light.primary, fontWeight: '900' },
});

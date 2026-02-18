/* eslint-disable @typescript-eslint/no-unused-vars */
// screens/Messages.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Tooltip from '../../configs/Tooltip';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../../../core/theme/colors';
import { d_assets } from '../../configs/assets';
import { auth, db as firestoreDb } from '../auth/firebaseConfig';

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  orderBy,
  limit,
  documentId,
} from 'firebase/firestore';

import Requests from './Requests';

// ✅ CHAT (socket + sqlite)
import { ENV } from '../../../../src/config/env';
import { bootstrapChat } from '../../../../src/chat/chatBootstrap';
import { listMessages } from '../../../../src/chat/localDb';
import { getSocketOrNull } from '../../../../src/chat/socket';

type RoomRow = {
  id: string;
  name: string;
  avatar?: string;
  isPublic?: boolean;
  isPersonal?: boolean;
  isGroup?: boolean;
  members?: string[];
  description?: string;
  lastMessage?: string | null;
  unreadCount?: number;
};

export default function Messages({ navigation }: any) {
  const { t } = useTranslation();
  const currentUser = auth.currentUser;

  const [chatRooms, setChatRooms] = useState<RoomRow[]>([]);
  const [userChatRooms, setUserChatRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  // Create platform
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [platformName, setPlatformName] = useState('');
  const [platformDescription, setPlatformDescription] = useState('');
  const [submittingPlatform, setSubmittingPlatform] = useState(false);

  // Friends
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'groups' | 'friends'>('groups');
  const [searchRooms, setSearchRooms] = useState('');

  // ✅ prevent multi bootstrap
  const didBootstrap = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    // ✅ bootstrap socket EARLY here so ChatRoom opens instantly
    const boot = async () => {
      try {
        if (didBootstrap.current) return;
        didBootstrap.current = true;

        await bootstrapChat({
          socketUrl: ENV.socketUrl,
          getUid: () => auth.currentUser?.uid || null,
          getToken: async () => {
            const u = auth.currentUser;
            if (!u) throw new Error('NO_USER');
            const token = await u.getIdToken(true);
            if (!token) throw new Error('NO_TOKEN');
            return token;
          },
        });

        const s = getSocketOrNull();
        console.log('[messages] socket ready?', !!s);
      } catch (e: any) {
        console.log('[messages] bootstrap error', e?.message || e);
      }
    };

    boot();

    fetchChatRooms();
    fetchFriends();
    fetchFriendRequests();
    fetchAllUsers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Filter users
  useEffect(() => {
    if (allUsers.length === 0) return;
    if (!userSearch.trim()) setFilteredUsers(allUsers);
    else {
      const s = userSearch.toLowerCase();
      setFilteredUsers(
        allUsers.filter(
          u =>
            u.email?.toLowerCase().includes(s) ||
            u.firstName?.toLowerCase().includes(s) ||
            u.lastName?.toLowerCase().includes(s),
        ),
      );
    }
  }, [userSearch, allUsers]);

  const prettyName = (u: any) =>
    `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

  // ---------- FAST helpers from SQLite ----------
  const getLastLocalMessageText = async (chatId: string) => {
    try {
      const rows = await listMessages(chatId, 1);
      if (!rows || rows.length === 0) return null;
      const m = rows[rows.length - 1];
      if (m.deletedForAll) return 'Message deleted';
      if (m.type === 'text') return m.text || null;
      if (m.type === 'image') return '📷 Photo';
      if (m.type === 'audio') return '🎤 Voice message';
      if (m.type === 'file') return '📎 File';
      return null;
    } catch {
      return null;
    }
  };

  // NOTE: true unread needs per-user receipts. For now,
  // we keep your simple unread behavior as fallback.
  const getUnreadCountFast = async (_chatId: string) => {
    return 0; // ✅ “fast open”: show instantly; you can compute later if you track read state
  };

  // ---------- Firestore fetch ----------
  const fetchAllUsers = async () => {
    try {
      setLoadingFriends(true);
      const usersQuery = query(collection(firestoreDb, 'user_data'));
      const qs = await getDocs(usersQuery);

      const usersData = qs.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUser?.uid);

      setAllUsers(usersData);
      setFilteredUsers(usersData);
    } catch (e) {
      console.error('Error fetching all users:', e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchChatRooms = async () => {
    try {
      setLoading(true);

      // ✅ use onSnapshot so your list is realtime
      const roomsQuery = query(collection(firestoreDb, 'chatrooms'));
      const unsubscribe = onSnapshot(roomsQuery, async snap => {
        const rooms: RoomRow[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any),
        }));

        const userRooms = rooms.filter(
          r => r.members && r.members.includes(currentUser!.uid),
        );

        // ✅ FAST: compute lastMessage/unread from SQLite first (instant UI)
        const userRoomsFast = await Promise.all(
          userRooms.map(async r => {
            const lastMessage = await getLastLocalMessageText(r.id);
            const unreadCount = await getUnreadCountFast(r.id);
            return { ...r, lastMessage, unreadCount };
          }),
        );

        const roomsFast = await Promise.all(
          rooms.map(async r => {
            const lastMessage = await getLastLocalMessageText(r.id);
            return { ...r, lastMessage };
          }),
        );

        setChatRooms(roomsFast);
        setUserChatRooms(userRoomsFast);
        setLoading(false);
      });

      return unsubscribe;
    } catch (e) {
      console.error('Error fetching chat rooms:', e);
      setLoading(false);
    }
  };

  const checkPendingRequest = async (roomId: string): Promise<boolean> => {
    try {
      const requestsQuery = query(
        collection(firestoreDb, 'joinRequests'),
        where('userId', '==', currentUser?.uid),
        where('roomId', '==', roomId),
      );
      const snap = await getDocs(requestsQuery);
      return !snap.empty;
    } catch (e) {
      console.error('Error checking pending request:', e);
      return false;
    }
  };

  // ---------- Navigation ----------
  const handleOpenChat = async (room: RoomRow) => {
    const isUserMember = userChatRooms.some(r => r.id === room.id);

    // ✅ if already in room => open instantly and pass prefetched data
    if (isUserMember) {
      const prefetchedMessages = await listMessages(room.id, 120);

      navigation.navigate('ChatRoom', {
        chatId: room.id,
        chatName: room.name,
        chatAvatar: room.avatar || '',
        prefetchedMessages,
        prefetchedLastMessage: room.lastMessage || null,
        prefetchedUnread: room.unreadCount || 0,
      });
      return;
    }

    // public room => join directly then open
    if (room.isPublic) {
      try {
        const roomRef = doc(firestoreDb, 'chatrooms', room.id);
        await updateDoc(roomRef, { members: arrayUnion(currentUser?.uid) });

        navigation.navigate('ChatRoom', {
          chatId: room.id,
          chatName: room.name,
          chatAvatar: room.avatar || '',
          prefetchedMessages: [],
          prefetchedLastMessage: null,
          prefetchedUnread: 0,
        });
      } catch (e) {
        Alert.alert(t('messages.error'), t('messagesScreen.failedJoinRoom'));
      }
      return;
    }

    const hasPending = await checkPendingRequest(room.id);
    setSelectedRoom({ ...room, hasPendingRequest: hasPending });
    setShowJoinModal(true);
  };

  // ----- Friends / Requests / Create platform (keep your existing logic) -----
  const fetchFriends = async () => {
    try {
      if (!currentUser) return;

      const friendsQuery = query(
        collection(firestoreDb, 'friends'),
        where('users', 'array-contains', currentUser.uid),
      );

      const qs = await getDocs(friendsQuery);
      setFriends(qs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error fetching friends:', e);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      if (!currentUser) return;

      const requestsQuery = query(
        collection(firestoreDb, 'friendRequests'),
        where('receiverId', '==', currentUser.uid),
        where('status', '==', 'pending'),
      );

      const sentRequestsQuery = query(
        collection(firestoreDb, 'friendRequests'),
        where('senderId', '==', currentUser.uid),
      );

      const [requestsSnapshot, sentSnapshot] = await Promise.all([
        getDocs(requestsQuery),
        getDocs(sentRequestsQuery),
      ]);

      const requestsData = requestsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      const sentData = sentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      setFriendRequests(requestsData);
      setSentRequests(sentData);
      setPendingRequestsCount(requestsData.length);
    } catch (e) {
      console.error('Error fetching friend requests:', e);
    }
  };

  const handleApplyToJoin = async () => {
    if (!selectedRoom || !currentUser) return;
    try {
      setPendingRequest(true);

      await addDoc(collection(firestoreDb, 'joinRequests'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setShowJoinModal(false);
      setShowConfirmation(true);
    } catch (e) {
      console.error('Error submitting join request:', e);
      Alert.alert(t('messagesScreen.error'), t('messagesScreen.failedSendRequest'));
    } finally {
      setPendingRequest(false);
    }
  };

  const handleCreatePlatform = async () => {
    if (!platformName.trim() || !platformDescription.trim()) {
      Alert.alert(t('messages.error'), t('messages.fillAllFields'));
      return;
    }
    if (!currentUser) return;

    try {
      setSubmittingPlatform(true);

      await addDoc(collection(firestoreDb, 'platformRequests'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        platformName: platformName.trim(),
        description: platformDescription.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Your platform creation request has been submitted to the admin');
      setShowCreateModal(false);
      setPlatformName('');
      setPlatformDescription('');
    } catch (e) {
      console.error('Error submitting platform request:', e);
      Alert.alert(t('messages.error'), t('messages.failedSubmitRequest'));
    } finally {
      setSubmittingPlatform(false);
    }
  };

  // ----- UI helpers -----
  const avatarSourceForRoom = (room: any) => {
    if (
      room.avatar &&
      typeof room.avatar === 'string' &&
      room.avatar.trim() !== '' &&
      room.avatar.startsWith('http')
    ) {
      return { uri: room.avatar };
    }
    return d_assets.images.appLogo;
  };

  // ✅ minimal list (remove big badges)
  const filteredUserRooms = useMemo(() => {
    const list = userChatRooms.filter(room =>
      activeTab === 'groups' ? !room.isPersonal : room.isPersonal,
    );
    if (!searchRooms.trim()) return list;
    const s = searchRooms.toLowerCase();
    return list.filter(r => (r.name || '').toLowerCase().includes(s));
  }, [userChatRooms, activeTab, searchRooms]);

  const filteredAvailableRooms = useMemo(() => {
    const list = chatRooms.filter(room => !userChatRooms.some(r => r.id === room.id));
    if (!searchRooms.trim()) return list;
    const s = searchRooms.toLowerCase();
    return list.filter(r => (r.name || '').toLowerCase().includes(s));
  }, [chatRooms, userChatRooms, searchRooms]);

  const renderRoomItem = ({ item }: { item: RoomRow }) => {
    const isUserMember = userChatRooms.some(r => r.id === item.id);
    const isPrivateLocked = !isUserMember && !item.isPublic;

    return (
      <Pressable style={styles.roomCard} onPress={() => handleOpenChat(item)}>
        <View style={styles.roomAvatarWrap}>
          <Image
            source={avatarSourceForRoom(item)}
            style={styles.roomAvatar}
            defaultSource={d_assets.images.appLogo}
          />
          {isPrivateLocked && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.roomTopRow}>
            <Text style={styles.roomName} numberOfLines={1}>
              {item.name}
            </Text>

            {isUserMember && (item.unreadCount || 0) > 0 ? (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
            )}
          </View>

          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || item.description || t('messages.noMessagesYet')}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Image source={d_assets.images.appLogo} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>{t('messages.title')}</Text>
            <Text style={styles.headerSub}>
              {activeTab === 'groups' ? t('messages.groups') : t('messages.friends')}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Tooltip text="Create Platform">
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add-circle-outline" size={21} color="#111" />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Requests">
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowRequestsModal(true)}>
              <Ionicons name="mail-unread-outline" size={21} color="#111" />
              {pendingRequestsCount > 0 && (
                <View style={styles.dotBadge}>
                  <Text style={styles.dotBadgeText}>{pendingRequestsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Add Friends">
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowFriendsModal(true)}>
              <Ionicons name="person-add-outline" size={21} color="#111" />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Settings">
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={21} color="#111" />
            </TouchableOpacity>
          </Tooltip>
        </View>
      </View>

      {/* Segmented tabs */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'groups' && styles.segmentActive]}
          onPress={() => setActiveTab('groups')}
          activeOpacity={0.9}
        >
          <Ionicons name="people" size={18} color={activeTab === 'groups' ? COLORS.light.primary : '#666'} />
          <Text style={[styles.segmentText, activeTab === 'groups' && styles.segmentTextActive]}>
            {t('messages.groups')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'friends' && styles.segmentActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.9}
        >
          <Ionicons name="person" size={18} color={activeTab === 'friends' ? COLORS.light.primary : '#666'} />
          <Text style={[styles.segmentText, activeTab === 'friends' && styles.segmentTextActive]}>
            {t('messages.friends')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          placeholder={activeTab === 'groups' ? 'Search groups...' : 'Search friend chats...'}
          placeholderTextColor="#999"
          value={searchRooms}
          onChangeText={setSearchRooms}
          style={styles.searchInput}
        />
        {!!searchRooms.trim() && (
          <TouchableOpacity onPress={() => setSearchRooms('')} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color="#111" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={i => i.key}
        renderItem={() => (
          <View style={{ paddingBottom: 24 }}>
            {/* Your rooms */}
            {filteredUserRooms.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'groups' ? t('messages.yourRooms') : t('messages.friendChats')}
                </Text>
                {filteredUserRooms.map(room => (
                  <View key={room.id}>{renderRoomItem({ item: room })}</View>
                ))}
              </View>
            )}

            {/* Available rooms */}
            {activeTab === 'groups' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('messages.availableRooms')}</Text>
                {filteredAvailableRooms.length > 0 ? (
                  filteredAvailableRooms.map(room => (
                    <View key={room.id}>{renderRoomItem({ item: room })}</View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{t('messages.noRooms')}</Text>
                )}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Join Request Modal */}
      <Modal transparent visible={showJoinModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalTitle}>{t('messages.requestTitle')}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              {selectedRoom?.hasPendingRequest
                ? t('messages.alreadyRequested', { name: selectedRoom?.name })
                : t('messages.requestText', { name: selectedRoom?.name })}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowJoinModal(false)}>
                <Text style={styles.modalBtnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              {!selectedRoom?.hasPendingRequest && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary, pendingRequest && { opacity: 0.6 }]}
                  onPress={handleApplyToJoin}
                  disabled={pendingRequest}
                >
                  {pendingRequest ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>{t('common.apply')}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal transparent visible={showConfirmation} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.light.primary} />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>{t('messages.requestSent')}</Text>
            <Text style={[styles.modalText, { textAlign: 'center' }]}>
              {t('messages.confirmText', { name: selectedRoom?.name })}
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary, { alignSelf: 'center', minWidth: 140 }]}
              onPress={() => setShowConfirmation(false)}
            >
              <Text style={styles.modalBtnPrimaryText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Platform Modal */}
      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalTitle}>{t('messages.createPlatformRequest')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  setPlatformName('');
                  setPlatformDescription('');
                }}
              >
                <Ionicons name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Platform Name</Text>
              <TextInput
                style={styles.textField}
                placeholder="e.g. Celeone Community"
                placeholderTextColor="#9A9A9A"
                value={platformName}
                onChangeText={setPlatformName}
                maxLength={50}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textField, styles.textArea]}
                placeholder="Describe your platform..."
                placeholderTextColor="#9A9A9A"
                value={platformDescription}
                onChangeText={setPlatformDescription}
                multiline
                numberOfLines={4}
                maxLength={200}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => {
                  setShowCreateModal(false);
                  setPlatformName('');
                  setPlatformDescription('');
                }}
              >
                <Text style={styles.modalBtnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, submittingPlatform && { opacity: 0.6 }]}
                onPress={handleCreatePlatform}
                disabled={submittingPlatform}
              >
                {submittingPlatform ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>{t('messages.submitRequest')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Requests Modal */}
      <Modal transparent={false} visible={showRequestsModal} animationType="slide">
        <Requests onClose={() => setShowRequestsModal(false)} />
      </Modal>

      {/* Friends Modal (left as-is: you can keep your version) */}
      <Modal transparent={false} visible={showFriendsModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.friendsTopBar}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowFriendsModal(false)}>
              <Ionicons name="arrow-back" size={20} color="#111" />
            </TouchableOpacity>
            <Text style={styles.friendsTitle}>{t('messages.addFriends')}</Text>
            <View style={{ width: 42 }} />
          </View>

          <View style={[styles.searchWrap, { marginTop: 10, marginHorizontal: 16 }]}>
            <Ionicons name="search-outline" size={18} color="#777" />
            <TextInput
              placeholder={t('messages.searchUsersPlaceholder')}
              placeholderTextColor="#999"
              value={userSearch}
              onChangeText={setUserSearch}
              style={styles.searchInput}
            />
            {!!userSearch.trim() && (
              <TouchableOpacity onPress={() => setUserSearch('')} style={styles.clearBtn}>
                <Ionicons name="close" size={16} color="#111" />
              </TouchableOpacity>
            )}
          </View>

          {loadingFriends && (
            <View style={{ paddingVertical: 10 }}>
              <ActivityIndicator size="small" color={COLORS.light.primary} />
            </View>
          )}

          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <Image
                  source={item.avatar ? { uri: item.avatar } : d_assets.images.appLogo}
                  style={styles.userAvatar}
                  defaultSource={d_assets.images.appLogo}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {prettyName(item) || item.email}
                  </Text>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>

                <TouchableOpacity style={styles.pillBtn} activeOpacity={0.9}>
                  <Text style={styles.pillBtnText}>{t('messages.sendRequest')}</Text>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

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
  dotBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  segmentWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
  },
  segmentActive: {
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.30)',
  },
  segmentText: { fontSize: 13.5, fontWeight: '900', color: '#666' },
  segmentTextActive: { color: COLORS.light.primary },

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

  sectionBlock: { marginTop: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#888', fontWeight: '800', paddingVertical: 16 },

  roomCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 10,
  },
  roomAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#F2F3F5',
    overflow: 'hidden',
    position: 'relative',
  },
  roomAvatar: { width: '100%', height: '100%' },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  roomTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roomName: { flex: 1, fontSize: 15.5, fontWeight: '900', color: '#111' },
  lastMessage: { marginTop: 4, fontSize: 13.5, fontWeight: '700', color: '#6A6A6A' },

  unreadPill: {
    backgroundColor: COLORS.light.primary,
    minWidth: 26,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    ...(Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }) as any),
  },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  modalTitle: { fontSize: 16.5, fontWeight: '900', color: '#111' },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalText: { marginTop: 10, fontSize: 13.5, fontWeight: '700', color: '#666', lineHeight: 19 },
  modalBtnRow: { marginTop: 14, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: '#F2F3F5' },
  modalBtnGhostText: { fontWeight: '900', color: '#111' },
  modalBtnPrimary: { backgroundColor: COLORS.light.primary },
  modalBtnPrimaryText: { fontWeight: '900', color: '#fff' },

  formField: { marginTop: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '900', color: '#555', marginBottom: 8 },
  textField: {
    backgroundColor: '#F2F3F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111',
  },
  textArea: { height: 110, textAlignVertical: 'top' },

  friendsTopBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsTitle: { fontSize: 16.5, fontWeight: '900', color: '#111' },

  userCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 10,
    alignItems: 'center',
  },
  userAvatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#F2F3F5' },
  userName: { fontSize: 15.5, fontWeight: '900', color: '#111' },
  userEmail: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#6B6B6B' },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
  },
  pillBtnText: { color: COLORS.light.primary, fontWeight: '900', fontSize: 12.5 },
});

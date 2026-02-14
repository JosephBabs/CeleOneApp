import React, { useMemo, useState, useEffect } from 'react';
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
import Tooltip from '../../configs/Tooltip';

import { useTranslation } from 'react-i18next';
import styless from '../../../../styles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../../core/theme/colors';
import { d_assets } from '../../configs/assets';
import { auth, db } from '../auth/firebaseConfig';
import Requests from './Requests';

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
} from 'firebase/firestore';

export default function Messages({ navigation }: any) {
  const { t } = useTranslation();
  const currentUser = auth.currentUser;

  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [userChatRooms, setUserChatRooms] = useState<any[]>([]);
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

  const [messageListeners, setMessageListeners] = useState<(() => void)[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'friends'>('groups');

  const [searchRooms, setSearchRooms] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchChatRooms();
      fetchFriends();
      fetchFriendRequests();
      fetchAllUsers(); // for lastMessage sender name formatting
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    return () => {
      messageListeners.forEach(unsubscribe => unsubscribe());
    };
  }, [messageListeners]);

  // Fetch all users when friends modal opens
  useEffect(() => {
    if (showFriendsModal && currentUser) {
      fetchAllUsers();
    }
  }, [showFriendsModal, currentUser]);

  // Filter users
  useEffect(() => {
    if (allUsers.length > 0) {
      if (!userSearch.trim()) {
        setFilteredUsers(allUsers);
      } else {
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
    }
  }, [userSearch, allUsers]);

  const prettyName = (u: any) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

  // ----- Data Fetching -----
  const fetchAllUsers = async () => {
    try {
      setLoadingFriends(true);
      const usersQuery = query(collection(db, 'user_data'));
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
      const roomsQuery = query(collection(db, 'chatrooms'));

      const unsubscribe = onSnapshot(roomsQuery, async querySnapshot => {
        const rooms = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const userRooms = rooms.filter(
          r => r.members && r.members.includes(currentUser?.uid),
        );

        const userRoomsWithData = await Promise.all(
          userRooms.map(async r => {
            const lastMessage = await getLastMessage(r.id);
            const unreadCount = await getUnreadCount(r.id);
            return { ...r, lastMessage, unreadCount };
          }),
        );

        const roomsWithLastMessage = await Promise.all(
          rooms.map(async r => {
            const lastMessage = await getLastMessage(r.id);
            return { ...r, lastMessage };
          }),
        );

        setChatRooms(roomsWithLastMessage);
        setUserChatRooms(userRoomsWithData);
        setLoading(false);

        setupMessageListeners(userRooms);
      });

      return unsubscribe;
    } catch (e) {
      console.error('Error fetching chat rooms:', e);
      setLoading(false);
    }
  };

  const setupMessageListeners = (rooms: any[]) => {
    const newListeners: (() => void)[] = [];

    rooms.forEach(room => {
      const messagesQuery = query(
        collection(db, 'chatrooms', room.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1),
      );

      const unsubscribe = onSnapshot(messagesQuery, async snapshot => {
        if (!snapshot.empty) {
          const lastMessageDoc = snapshot.docs[0];
          const messageData = lastMessageDoc.data();
          const messageText = messageData.text || messageData.content || null;
          const senderId = messageData.senderId || messageData.userId || null;

          let formattedMessage = messageText;

          if (messageText && senderId) {
            if (senderId === currentUser?.uid) {
              formattedMessage = `${t('messages.you')}: ${messageText}`;
            } else {
              const sender = allUsers.find(u => u.id === senderId);
              if (sender) formattedMessage = `${prettyName(sender)}: ${messageText}`;
            }
          }

          setChatRooms(prev =>
            prev.map(r => (r.id === room.id ? { ...r, lastMessage: formattedMessage } : r)),
          );
          setUserChatRooms(prev =>
            prev.map(r => (r.id === room.id ? { ...r, lastMessage: formattedMessage } : r)),
          );
        }
      });

      newListeners.push(unsubscribe);
    });

    setMessageListeners(newListeners);
  };

  const getLastMessage = async (roomId: string): Promise<string | null> => {
    try {
      const messagesQuery = query(
        collection(db, 'chatrooms', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1),
      );

      const qs = await getDocs(messagesQuery);
      if (!qs.empty) {
        const m = qs.docs[0].data();
        const messageText = m.text || m.content || null;
        const senderId = m.senderId || m.userId || null;

        if (messageText && senderId) {
          if (senderId === currentUser?.uid) return `${t('messages.you')}: ${messageText}`;
          const sender = allUsers.find(u => u.id === senderId);
          if (sender) return `${prettyName(sender)}: ${messageText}`;
        }
        return messageText;
      }
      return null;
    } catch (e) {
      console.error('Error getting last message:', e);
      return null;
    }
  };

  const getUnreadCount = async (roomId: string): Promise<number> => {
    try {
      if (!currentUser?.uid) return 0;

      const messagesQuery = query(
        collection(db, 'chatrooms', roomId, 'messages'),
        where('userId', '!=', currentUser.uid),
      );

      const snap = await getDocs(messagesQuery);
      return snap.size;
    } catch (e) {
      console.error('Error getting unread count', e);
      return 0;
    }
  };

  const checkPendingRequest = async (roomId: string): Promise<boolean> => {
    try {
      const requestsQuery = query(
        collection(db, 'joinRequests'),
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

  // ----- Navigation & Actions -----
  const handleOpenChat = async (room: any) => {
    const isUserMember = userChatRooms.some(r => r.id === room.id);

    if (isUserMember) {
      navigation.navigate('ChatRoom', {
        chatId: room.id,
        chatName: room.name,
        chatAvatar: room.avatar,
      });
      return;
    }

    if (room.isPublic) {
      try {
        const roomRef = doc(db, 'chatrooms', room.id);
        await updateDoc(roomRef, { members: arrayUnion(currentUser?.uid) });

        navigation.navigate('ChatRoom', {
          chatId: room.id,
          chatName: room.name,
          chatAvatar: room.avatar,
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

  const handleApplyToJoin = async () => {
    if (!selectedRoom || !currentUser) return;
    try {
      setPendingRequest(true);

      await addDoc(collection(db, 'joinRequests'), {
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

  const fetchFriends = async () => {
    try {
      if (!currentUser) return;

      const friendsQuery = query(
        collection(db, 'friends'),
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
        collection(db, 'friendRequests'),
        where('receiverId', '==', currentUser.uid),
        where('status', '==', 'pending'),
      );

      const sentRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', currentUser.uid),
      );

      const [requestsSnapshot, sentSnapshot] = await Promise.all([
        getDocs(requestsQuery),
        getDocs(sentRequestsQuery),
      ]);

      const requestsData = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const sentData = sentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      setFriendRequests(requestsData);
      setSentRequests(sentData);
      setPendingRequestsCount(requestsData.length);
    } catch (e) {
      console.error('Error fetching friend requests:', e);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      if (!currentUser) return;

      const requestData = {
        senderId: currentUser.uid,
        senderName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
        senderEmail: currentUser.email,
        receiverId,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'friendRequests'), requestData);
      Alert.alert(t('messages.success'), t('messages.friendRequestSent'));
      fetchFriendRequests();
    } catch (e) {
      console.error('Error sending friend request:', e);
      Alert.alert(t('messages.error'), t('messages.failedSendFriendRequest'));
    }
  };

  const startChatWithFriend = async (friendId: string) => {
    try {
      if (!currentUser) return;

      const chatQuery = query(
        collection(db, 'chatrooms'),
        where('members', 'array-contains', currentUser.uid),
        where('isPersonal', '==', true),
      );

      const qs = await getDocs(chatQuery);
      let existingChat: any = null;

      qs.docs.forEach(d => {
        const room = { id: d.id, ...d.data() };
        if (room.members.includes(friendId)) existingChat = room;
      });

      if (existingChat) {
        navigation.navigate('ChatRoom', {
          chatId: existingChat.id,
          chatName: existingChat.name,
          chatAvatar: existingChat.avatar,
        });
        return;
      }

      const friendUser = allUsers.find(u => u.id === friendId);
      const friendName = friendUser ? prettyName(friendUser) : 'Friend';

      const chatRoomData = {
        name: friendName,
        avatar: '',
        createdBy: currentUser.uid,
        members: [currentUser.uid, friendId],
        admins: [currentUser.uid, friendId],
        isPublic: false,
        isPersonal: true,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'chatrooms'), chatRoomData);

      navigation.navigate('ChatRoom', {
        chatId: docRef.id,
        chatName: friendName,
        chatAvatar: '',
      });
    } catch (e) {
      console.error('Error starting chat with friend:', e);
      Alert.alert(t('messages.error'), t('messages.failedStartChat'));
    }
  };

  const acceptFriendRequest = async (requestId: string, senderId: string, senderName: string) => {
    try {
      if (!currentUser) return;

      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' });

      await addDoc(collection(db, 'friends'), {
        users: [currentUser.uid, senderId],
        createdAt: serverTimestamp(),
      });

      const chatRoomData = {
        name: senderName,
        avatar: '',
        createdBy: currentUser.uid,
        members: [currentUser.uid, senderId],
        admins: [currentUser.uid, senderId],
        isPublic: false,
        isPersonal: true,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'chatrooms'), chatRoomData);

      Alert.alert(t('messages.success'), t('messages.friendRequestAccepted'));
      fetchFriends();
      fetchFriendRequests();
    } catch (e) {
      console.error('Error accepting friend request:', e);
      Alert.alert(t('messages.error'), t('messages.failedAcceptFriendRequest'));
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
      Alert.alert(t('messages.success'), t('messages.friendRequestRejected'));
      fetchFriendRequests();
    } catch (e) {
      console.error('Error rejecting friend request:', e);
      Alert.alert(t('messages.error'), t('messages.failedRejectFriendRequest'));
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

      await addDoc(collection(db, 'platformRequests'), {
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

  // ----- Lists -----
  const avatarSourceForRoom = (room: any) => {
    if (room.avatar && typeof room.avatar === 'string' && room.avatar.trim() !== '' && room.avatar.startsWith('http')) {
      return { uri: room.avatar };
    }
    return d_assets.images.appLogo;
  };

  const filteredUserRooms = useMemo(() => {
    const list = userChatRooms.filter(room => (activeTab === 'groups' ? !room.isPersonal : room.isPersonal));
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

  const renderRoomItem = ({ item }: any) => {
    const isUserMember = userChatRooms.some(r => r.id === item.id);
    const statusText = isUserMember ? null : item.isPublic ? t('messages.public') : t('messages.private');

    return (
      <Pressable style={styles.roomCard} onPress={() => handleOpenChat(item)}>
        <View style={styles.roomAvatarWrap}>
          <Image source={avatarSourceForRoom(item)} style={styles.roomAvatar} defaultSource={d_assets.images.appLogo} />
          {!isUserMember && !item.isPublic && (
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

            {/* Right side: badge / status */}
            {isUserMember && item.unreadCount > 0 ? (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            ) : !isUserMember ? (
              <View
                style={[
                  styles.statusPill,
                  item.isPublic ? styles.statusPublic : styles.statusPrivate,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    item.isPublic ? { color: '#1E9E52' } : { color: '#C0392B' },
                  ]}
                >
                  {statusText}
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
            )}
          </View>

          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && isUserMember && { fontWeight: '900', color: '#111' },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || item.description || t('messages.noMessagesYet')}
          </Text>

          <View style={styles.roomMetaRow}>
            <View style={[styles.metaChip, { backgroundColor: '#F2F3F5' }]}>
              <Ionicons name={item.isPublic ? 'globe-outline' : 'shield-checkmark-outline'} size={13} color="#444" />
              <Text style={styles.metaChipText}>{item.isPublic ? t('messages.public') : t('messages.private')}</Text>
            </View>

            <View style={[styles.metaChip, { backgroundColor: 'rgba(46,204,113,0.14)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)' }]}>
              <Ionicons name="people-outline" size={13} color={COLORS.light.primary} />
              <Text style={[styles.metaChipText, { color: COLORS.light.primary }]}>
                {(item.members?.length || 0).toString()} members
              </Text>
            </View>
          </View>
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

      {/* Header like Settings style (clean) */}
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

          <Tooltip text="Notifications">
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={21} color="#111" />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Requests">
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowRequestsModal(true)}
            >
              <Ionicons name="mail-unread-outline" size={21} color="#111" />
              {pendingRequestsCount > 0 && (
                <View style={styles.dotBadge}>
                  <Text style={styles.dotBadgeText}>{pendingRequestsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Add Friends">
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowFriendsModal(true)}
            >
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

      {/* Segmented Tabs (settings style) */}
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
          placeholder={activeTab === 'groups' ? 'Search groups...' : 'Search friends chats...'}
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
            {/* Friend Requests */}
            {activeTab === 'friends' && friendRequests.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionTitle}>{t('messages.friendRequests')}</Text>
                  <View style={styles.sectionCountPill}>
                    <Text style={styles.sectionCountText}>{friendRequests.length}</Text>
                  </View>
                </View>

                {friendRequests.map(req => (
                  <View key={req.id} style={styles.requestCard}>
                    <Image
                      source={req.senderAvatar ? { uri: req.senderAvatar } : d_assets.images.appLogo}
                      style={styles.userAvatar}
                      defaultSource={d_assets.images.appLogo}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {req.senderName}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {req.senderEmail}
                      </Text>

                      <View style={styles.requestBtnRow}>
                        <TouchableOpacity
                          style={[styles.smallBtn, styles.smallBtnPrimary]}
                          onPress={() => acceptFriendRequest(req.id, req.senderId, req.senderName)}
                        >
                          <Text style={styles.smallBtnTextPrimary}>{t('messages.accept')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallBtn, styles.smallBtnDanger]}
                          onPress={() => rejectFriendRequest(req.id)}
                        >
                          <Text style={styles.smallBtnTextDanger}>{t('messages.reject')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

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

      {/* Join Request Modal (glass-style card) */}
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
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setShowJoinModal(false)}
              >
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

      {/* Friends Modal */}
      <Modal transparent={false} visible={showFriendsModal} animationType="slide">
        <View style={styles.friendsModal}>
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
            renderItem={({ item }) => {
              const isRequestSent = sentRequests.some(
                req => req.receiverId === item.id && req.status === 'pending',
              );
              const isFriend = friends.some(
                friendship =>
                  friendship.users.includes(currentUser.uid) &&
                  friendship.users.includes(item.id),
              );

              return (
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

                  <TouchableOpacity
                    style={[
                      styles.pillBtn,
                      (isRequestSent || isFriend) && { backgroundColor: '#E6E7EA' },
                    ]}
                    onPress={() =>
                      isFriend
                        ? startChatWithFriend(item.id)
                        : !isRequestSent && sendFriendRequest(item.id)
                    }
                    disabled={isRequestSent}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.pillBtnText,
                        (isRequestSent || isFriend) && { color: '#666' },
                      ]}
                    >
                      {isFriend
                        ? t('messages.chat')
                        : isRequestSent
                        ? t('messages.requestSent')
                        : t('messages.sendRequest')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 }}
            ListEmptyComponent={
              !loadingFriends ? (
                <Text style={styles.noResultsText}>
                  {userSearch.trim() ? t('messages.noUsersFound') : t('messages.noUsersAvailable')}
                </Text>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header (settings-like)
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

  // Segmented tabs
  segmentWrap: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
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

  // Sections
  sectionBlock: { marginTop: 14 },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sectionCountPill: {
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.30)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionCountText: { color: COLORS.light.primary, fontWeight: '900' },

  // Room Card (settings-like listing)
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

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
  },
  statusPublic: {
    backgroundColor: 'rgba(30,158,82,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(30,158,82,0.25)',
  },
  statusPrivate: {
    backgroundColor: 'rgba(192,57,43,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.20)',
  },
  statusText: { fontSize: 12, fontWeight: '900' },

  roomMetaRow: { marginTop: 10, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 12, fontWeight: '800', color: '#444' },

  emptyText: { textAlign: 'center', color: '#888', fontWeight: '800', paddingVertical: 16 },

  // Friend Request card
  requestCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 10,
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#F2F3F5',
  },
  userName: { fontSize: 15.5, fontWeight: '900', color: '#111' },
  userEmail: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#6B6B6B' },
  requestBtnRow: { marginTop: 10, flexDirection: 'row', gap: 10 },

  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  smallBtnPrimary: { backgroundColor: COLORS.light.primary },
  smallBtnDanger: { backgroundColor: '#FF3B30' },
  smallBtnTextPrimary: { color: '#fff', fontWeight: '900' },
  smallBtnTextDanger: { color: '#fff', fontWeight: '900' },

  // Modal (glass-like)
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }),
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

  // Create platform fields
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

  // Friends modal
  friendsModal: { flex: 1, backgroundColor: '#fff' },
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
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
  },
  pillBtnText: { color: COLORS.light.primary, fontWeight: '900', fontSize: 12.5 },

  noResultsText: { textAlign: 'center', paddingVertical: 30, color: '#777', fontWeight: '800' },
});

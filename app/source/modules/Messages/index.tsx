import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Tooltip from '../../configs/Tooltip';

import { useTranslation } from 'react-i18next';
import styless from '../../../../styles';
import Icon from 'react-native-vector-icons/Ionicons';
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
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [platformName, setPlatformName] = useState('');
  const [platformDescription, setPlatformDescription] = useState('');
  const [submittingPlatform, setSubmittingPlatform] = useState(false);

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

  useEffect(() => {
    if (currentUser) {
      fetchChatRooms();
      fetchFriends();
      fetchFriendRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    // Clean up message listeners when component unmounts
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

  // Filter users based on search term
  useEffect(() => {
    if (allUsers.length > 0) {
      if (!userSearch.trim()) {
        setFilteredUsers(allUsers);
      } else {
        const searchTermLower = userSearch.toLowerCase();
        const filtered = allUsers.filter(
          user =>
            user.email?.toLowerCase().includes(searchTermLower) ||
            user.firstName?.toLowerCase().includes(searchTermLower) ||
            user.lastName?.toLowerCase().includes(searchTermLower),
        );
        setFilteredUsers(filtered);
      }
    }
  }, [userSearch, allUsers]);

  // Fetch all users from Firebase
  const fetchAllUsers = async () => {
    try {
      setLoadingFriends(true);
      const usersQuery = query(collection(db, 'user_data'));

      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(user => user.id !== currentUser?.uid); // Exclude current user

      setAllUsers(usersData);
      setFilteredUsers(usersData); // Initially show all users
    } catch (error) {
      console.error('Error fetching all users:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Fetch all chat rooms from Firebase
  // const fetchChatRooms = async () => {
  //   try {
  //     setLoading(true);
  //     const roomsQuery = query(collection(db, "chatrooms"));

  //     const unsubscribe = onSnapshot(roomsQuery, async (querySnapshot) => {
  //       const rooms = querySnapshot.docs.map((doc) => ({
  //         id: doc.id,
  //         ...doc.data(),
  //       }));

  //       // Check which rooms the user is a member of
  //       const userRooms = rooms.filter((room) =>
  //         room.members && room.members.includes(currentUser?.uid)
  //       );

  //       // Calculate unread counts for user rooms
  //       const userRoomsWithUnread = await Promise.all(
  //         userRooms.map(async (room) => {
  //           const unreadCount = await getUnreadCount(room.id);
  //           return { ...room, unreadCount };
  //         })
  //       );

  //       setChatRooms(rooms);
  //       setUserChatRooms(userRoomsWithUnread);
  //       setLoading(false);
  //     });

  //     return unsubscribe;
  //   } catch (error) {
  //     console.error("Error fetching chat rooms:", error);
  //     setLoading(false);
  //   }
  // };

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      const roomsQuery = query(collection(db, 'chatrooms'));

      const unsubscribe = onSnapshot(roomsQuery, async querySnapshot => {
        const rooms = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Check which rooms the user is a member of
        const userRooms = rooms.filter(
          room => room.members && room.members.includes(currentUser?.uid),
        );

        // Calculate unread counts and fetch last messages for user rooms
        const userRoomsWithData = await Promise.all(
          userRooms.map(async room => {
            const lastMessage = await getLastMessage(room.id);
            const unreadCount = await getUnreadCount(room.id);
            return { ...room, lastMessage, unreadCount };
          }),
        );

        // Fetch last messages for all rooms
        const roomsWithLastMessage = await Promise.all(
          rooms.map(async room => {
            const lastMessage = await getLastMessage(room.id);
            return { ...room, lastMessage };
          }),
        );

        setChatRooms(roomsWithLastMessage);
        setUserChatRooms(userRoomsWithData);
        setLoading(false);

        // Set up real-time listeners for messages in user's chat rooms
        setupMessageListeners(userRooms);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      setLoading(false);
    }
  };

  // Set up real-time listeners for messages in user's chat rooms
  const setupMessageListeners = (rooms: any[]) => {
    // Create a new array to store the new listeners
    const newListeners: (() => void)[] = [];

    // Set up new listeners
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

          // Format the last message with sender name
          let formattedMessage = messageText;
          if (messageText && senderId) {
            if (senderId === currentUser?.uid) {
              formattedMessage = `${t('messages.you')}: ${messageText}`;
            } else {
              // Get sender name from allUsers if available
              const sender = allUsers.find(user => user.id === senderId);
              if (sender) {
                const senderName = `${sender.firstName || ''} ${
                  sender.lastName || ''
                }`.trim();
                formattedMessage = `${senderName}: ${messageText}`;
              }
            }
          }

          // Update the specific room in the state
          setChatRooms(prevRooms =>
            prevRooms.map(r =>
              r.id === room.id ? { ...r, lastMessage: formattedMessage } : r,
            ),
          );

          setUserChatRooms(prevRooms =>
            prevRooms.map(r =>
              r.id === room.id ? { ...r, lastMessage: formattedMessage } : r,
            ),
          );
        }
      });

      newListeners.push(unsubscribe);
    });

    // Update the state with the new listeners
    setMessageListeners(newListeners);
  };

  // Get the last message for a specific room
  const getLastMessage = async (roomId: string): Promise<string | null> => {
    try {
      const messagesQuery = query(
        collection(db, 'chatrooms', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1),
      );

      const querySnapshot = await getDocs(messagesQuery);
      if (!querySnapshot.empty) {
        const lastMessageDoc = querySnapshot.docs[0];
        const messageData = lastMessageDoc.data();
        const messageText = messageData.text || messageData.content || null;
        const senderId = messageData.senderId || messageData.userId || null;

        // Format the last message with sender name
        if (messageText && senderId) {
          if (senderId === currentUser?.uid) {
            return `${t('messages.you')}: ${messageText}`;
          } else {
            // Get sender name from allUsers if available
            const sender = allUsers.find(user => user.id === senderId);
            if (sender) {
              const senderName = `${sender.firstName || ''} ${
                sender.lastName || ''
              }`.trim();
              return `${senderName}: ${messageText}`;
            }
          }
        }
        return messageText;
      }
      return null;
    } catch (error) {
      console.error('Error getting last message:', error);
      return null;
    }
  };

  // Get unread message count for a specific room
  const getUnreadCount = async (roomId: string): Promise<number> => {
    try {
      if (!currentUser?.uid) return 0;

      const messagesQuery = query(
        collection(db, 'chatrooms', roomId, 'messages'),
        where('userId', '!=', currentUser.uid),
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      return messagesSnapshot.size;
    } catch {
      console.error('Error getting unread count');
      return 0;
    }
  };

  // Check if user has pending request for a room
  const checkPendingRequest = async (roomId: string): Promise<boolean> => {
    try {
      const requestsQuery = query(
        collection(db, 'joinRequests'),
        where('userId', '==', currentUser?.uid),
        where('roomId', '==', roomId),
      );
      const snapshot = await getDocs(requestsQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking pending request:', error);
      return false;
    }
  };

  // Handle opening chat or requesting join
  const handleOpenChat = async (room: any) => {
    const isUserMember = userChatRooms.some(r => r.id === room.id);

    if (isUserMember) {
      // User is a member, open chat
      navigation.navigate('ChatRoom', {
        chatId: room.id,
        chatName: room.name,
        chatAvatar: room.avatar,
      });
    } else if (room.isPublic) {
      // Public room, add user and open chat
      try {
        // Add user to room members
        const roomRef = doc(db, 'chatrooms', room.id);
        await updateDoc(roomRef, {
          members: arrayUnion(currentUser?.uid),
        });
        // Open chat
        navigation.navigate('ChatRoom', {
          chatId: room.id,
          chatName: room.name,
          chatAvatar: room.avatar,
        });
      } catch (error) {
        Alert.alert(t('messages.error'), t('messagesScreen.failedJoinRoom'));
      }
    } else {
      // Private room, show join request modal
      const hasPending = await checkPendingRequest(room.id);
      setSelectedRoom({ ...room, hasPendingRequest: hasPending });
      setShowModal(true);
    }
  };

  // Submit join request to Firebase
  const handleApplyToJoin = async () => {
    if (!selectedRoom || !currentUser) return;

    try {
      setPendingRequest(true);

      // Add join request to Firebase
      await addDoc(collection(db, 'joinRequests'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        status: 'pending', // pending, approved, rejected
        createdAt: serverTimestamp(),
      });

      setShowModal(false);
      setShowConfirmation(true);
      setPendingRequest(false);
    } catch (error) {
      console.error('Error submitting join request:', error);
      Alert.alert(
        t('messagesScreen.error'),
        t('messagesScreen.failedSendRequest'),
      );
      setPendingRequest(false);
    }
  };

  // Fetch friends
  const fetchFriends = async () => {
    try {
      if (!currentUser) return;

      const friendsQuery = query(
        collection(db, 'friends'),
        where('users', 'array-contains', currentUser.uid),
      );

      const querySnapshot = await getDocs(friendsQuery);
      const friendsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setFriends(friendsData);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Fetch friend requests
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

      const requestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sentData = sentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setFriendRequests(requestsData);
      setSentRequests(sentData);
      setPendingRequestsCount(requestsData.length);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  // Search users
  const searchUsers = async (searchTerm: string) => {
    try {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setLoadingFriends(true);
      const searchTermLower = searchTerm.toLowerCase();

      // Create separate queries for email, firstName, and lastName
      const emailQuery = query(
        collection(db, 'user_data'),
        where('email', '>=', searchTermLower),
        where('email', '<=', searchTermLower + '\uf8ff'),
      );

      const firstNameQuery = query(
        collection(db, 'user_data'),
        where('firstName', '>=', searchTermLower),
        where('firstName', '<=', searchTermLower + '\uf8ff'),
      );

      const lastNameQuery = query(
        collection(db, 'user_data'),
        where('lastName', '>=', searchTermLower),
        where('lastName', '<=', searchTermLower + '\uf8ff'),
      );

      // Execute all queries in parallel
      const [emailSnapshot, firstNameSnapshot, lastNameSnapshot] =
        await Promise.all([
          getDocs(emailQuery),
          getDocs(firstNameQuery),
          getDocs(lastNameQuery),
        ]);

      // Combine results and remove duplicates
      const usersMap = new Map();

      // Add email matches
      emailSnapshot.docs.forEach(doc => {
        const user = { id: doc.id, ...doc.data() };
        usersMap.set(user.id, user);
      });

      // Add firstName matches
      firstNameSnapshot.docs.forEach(doc => {
        const user = { id: doc.id, ...doc.data() };
        usersMap.set(user.id, user);
      });

      // Add lastName matches
      lastNameSnapshot.docs.forEach(doc => {
        const user = { id: doc.id, ...doc.data() };
        usersMap.set(user.id, user);
      });

      // Convert to array and exclude current user
      const usersData = Array.from(usersMap.values()).filter(
        user => user.id !== currentUser?.uid,
      );

      setSearchResults(usersData);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Send friend request
  const sendFriendRequest = async (receiverId: string) => {
    try {
      if (!currentUser) return;

      const requestData = {
        senderId: currentUser.uid,
        senderName: `${currentUser.firstName || ''} ${
          currentUser.lastName || ''
        }`.trim(),
        senderEmail: currentUser.email,
        receiverId,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'friendRequests'), requestData);
      Alert.alert(t('messages.success'), t('messages.friendRequestSent'));
      fetchFriendRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert(t('messages.error'), t('messages.failedSendFriendRequest'));
    }
  };

  // Start chat with friend
  const startChatWithFriend = async (friendId: string) => {
    try {
      if (!currentUser) return;

      // Find existing personal chat room between current user and friend
      const chatQuery = query(
        collection(db, 'chatrooms'),
        where('members', 'array-contains', currentUser.uid),
        where('isPersonal', '==', true),
      );

      const querySnapshot = await getDocs(chatQuery);
      let existingChat = null;

      querySnapshot.docs.forEach(doc => {
        const room = { id: doc.id, ...doc.data() };
        if (room.members.includes(friendId)) {
          existingChat = room;
        }
      });

      if (existingChat) {
        // Navigate to existing chat
        navigation.navigate('ChatRoom', {
          chatId: existingChat.id,
          chatName: existingChat.name,
          chatAvatar: existingChat.avatar,
        });
      } else {
        // Create new personal chat room if not found
        const friendUser = allUsers.find(u => u.id === friendId);
        const friendName = friendUser
          ? `${friendUser.firstName || ''} ${friendUser.lastName || ''}`.trim()
          : 'Friend';

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

        // Navigate to new chat
        navigation.navigate('ChatRoom', {
          chatId: docRef.id,
          chatName: friendName,
          chatAvatar: '',
        });
      }
    } catch (error) {
      console.error('Error starting chat with friend:', error);
      Alert.alert(t('messages.error'), t('messages.failedStartChat'));
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (
    requestId: string,
    senderId: string,
    senderName: string,
  ) => {
    try {
      if (!currentUser) return;

      // Update request status
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'accepted',
      });

      // Create friendship
      await addDoc(collection(db, 'friends'), {
        users: [currentUser.uid, senderId],
        createdAt: serverTimestamp(),
      });

      // Create personal chat room with sender's name
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
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert(t('messages.error'), t('messages.failedAcceptFriendRequest'));
    }
  };

  // Reject friend request
  const rejectFriendRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'rejected',
      });

      Alert.alert(t('messages.success'), t('messages.friendRequestRejected'));
      fetchFriendRequests();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert(t('messages.error'), t('messages.failedRejectFriendRequest'));
    }
  };

  // Submit platform creation request
  const handleCreatePlatform = async () => {
    if (!platformName.trim() || !platformDescription.trim()) {
      Alert.alert(t('messages.error'), t('messages.fillAllFields'));
      return;
    }

    if (!currentUser) return;

    try {
      setSubmittingPlatform(true);

      const requestData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        platformName: platformName.trim(),
        description: platformDescription.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'platformRequests'), requestData);

      Alert.alert(
        'Success',
        'Your platform creation request has been submitted to the admin',
      );
      setShowCreateModal(false);
      setPlatformName('');
      setPlatformDescription('');
    } catch (error) {
      console.error('Error submitting platform request:', error);
      Alert.alert(t('messages.error'), t('messages.failedSubmitRequest'));
    } finally {
      setSubmittingPlatform(false);
    }
  };

  const renderRoomItem = ({ item }: any) => {
    const isUserMember = userChatRooms.some(r => r.id === item.id);
    const statusText = isUserMember
      ? null
      : item.isPublic
      ? t('messages.public')
      : t('messages.private');

    // Use app icon as fallback if no avatar
    const avatarSource =
      item.avatar &&
      typeof item.avatar === 'string' &&
      item.avatar.trim() !== '' &&
      item.avatar.startsWith('http')
        ? { uri: item.avatar }
        : d_assets.images.appLogo;

    return (
      <Pressable style={styles.card} onPress={() => handleOpenChat(item)}>
        {/* Avatar */}
        <View style={styles.iconContainer}>
          <Image
            source={avatarSource}
            style={styles.avatar}
            defaultSource={d_assets.images.appLogo}
          />
          {!isUserMember && !item.isPublic && (
            <View style={styles.lockBadge}>
              <Icon name="lock-closed" size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Chat Info */}
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && { fontWeight: 'bold', color: '#000' },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage ||
              item.description ||
              t('messages.noMessagesYet')}
          </Text>
        </View>

        {/* Unread Messages Badge or Status */}
        {isUserMember && item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        )}

        {/* Status text if not joined */}
        {!isUserMember && (
          <Text
            style={[styles.pendingText, item.isPublic && { color: '#4CAF50' }]}
          >
            {statusText}
          </Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: '#fff' }]}>
      <View style={styless.header1}>
        <Image source={d_assets.images.appLogo} style={styless.logo} />

        <View style={styless.headerIcons}>
          <Tooltip text="Create Platform">
            <TouchableOpacity onPress={() => setShowCreateModal(true)}>
              <Icon
                name="add-circle-outline"
                size={24}
                color="#444"
                style={styless.iconRight}
              />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Notifications" >
            
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
            >
              <Icon
                name="notifications-outline"
                size={24}
                color="#444"
                style={styless.iconRight}
              />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Add Friends">
            <TouchableOpacity
              // onPress={() => setShowFriendsModal(true)}
              style={styless.iconRight}
            >
              <Icon name="person-add-outline" size={24} color="#444" />
            </TouchableOpacity>
          </Tooltip>

          <Tooltip text="Settings">
            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
              <Icon name="settings-outline" size={24} color="#444" />
            </TouchableOpacity>
          </Tooltip>
        </View>
      </View>

      <Text style={styles.title}>{t('messages.title')}</Text>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Icon
            name="people"
            size={20}
            color={activeTab === 'groups' ? COLORS.light.primary : '#666'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'groups' && styles.activeTabText,
            ]}
          >
            {t('messages.groups')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Icon
            name="person"
            size={20}
            color={activeTab === 'friends' ? COLORS.light.primary : '#666'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'friends' && styles.activeTabText,
            ]}
          >
            {t('messages.friends')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Friend Requests Section - Only show in friends tab */}
      {activeTab === 'friends' && friendRequests.length > 0 && (
        <>
          <Text style={styles.subTitle}>{t('messages.friendRequests')}</Text>
          <FlatList
            data={friendRequests}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.requestItem}>
                <Image
                  source={
                    item.senderAvatar
                      ? { uri: item.senderAvatar }
                      : d_assets.images.appLogo
                  }
                  style={styles.userAvatar}
                  defaultSource={d_assets.images.appLogo}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.senderName}</Text>
                  <Text style={styles.userEmail}>{item.senderEmail}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: '#4CAF50', marginRight: 8 },
                    ]}
                    onPress={() =>
                      acceptFriendRequest(
                        item.id,
                        item.senderId,
                        item.senderName,
                      )
                    }
                  >
                    <Text style={styles.actionText}>
                      {t('messages.accept')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: '#f44336' },
                    ]}
                    onPress={() => rejectFriendRequest(item.id)}
                  >
                    <Text style={styles.actionText}>
                      {t('messages.reject')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 10 }}
            scrollEnabled={false}
          />
        </>
      )}

      {/* Your Chat Rooms */}
      {userChatRooms.filter(room =>
        activeTab === 'groups' ? !room.isPersonal : room.isPersonal,
      ).length > 0 && (
        <>
          <Text style={styles.subTitle}>
            {activeTab === 'groups'
              ? t('messages.yourRooms')
              : t('messages.friendChats')}
          </Text>
          <FlatList
            data={userChatRooms.filter(room =>
              activeTab === 'groups' ? !room.isPersonal : room.isPersonal,
            )}
            keyExtractor={item => item.id}
            renderItem={renderRoomItem}
            contentContainerStyle={{ paddingBottom: 10 }}
            scrollEnabled={false}
          />
        </>
      )}

      {/* Available Chat Rooms - Only show for groups tab */}
      {activeTab === 'groups' && (
        <>
          <Text style={styles.subTitle}>{t('messages.availableRooms')}</Text>
          <FlatList
            data={chatRooms.filter(
              room => !userChatRooms.some(r => r.id === room.id),
            )}
            keyExtractor={item => item.id}
            renderItem={renderRoomItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('messages.noRooms')}</Text>
            }
          />
        </>
      )}

      {/* Modal for Join Request */}
      <Modal transparent visible={showModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('messages.requestTitle')}</Text>
            <Text style={styles.modalText}>
              {selectedRoom?.hasPendingRequest
                ? t('messages.alreadyRequested', { name: selectedRoom?.name })
                : t('messages.requestText', { name: selectedRoom?.name })}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              {!selectedRoom?.hasPendingRequest && (
                <TouchableOpacity
                  style={[styles.applyBtn, pendingRequest && { opacity: 0.5 }]}
                  onPress={handleApplyToJoin}
                  disabled={pendingRequest}
                >
                  {pendingRequest ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.applyText}>{t('common.apply')}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Dialog */}
      <Modal transparent visible={showConfirmation} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Icon
              name="checkmark-circle"
              size={60}
              color={COLORS.light.primary}
              style={{ textAlign: 'center', marginBottom: 10 }}
            />
            <Text style={styles.modalTitle}>{t('messages.requestSent')}</Text>
            <Text style={styles.modalText}>
              {t('messages.confirmText', { name: selectedRoom?.name })}
            </Text>
            <TouchableOpacity
              style={[styles.applyBtn, { marginTop: 10 }]}
              onPress={() => setShowConfirmation(false)}
            >
              <Text style={styles.applyText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Platform Modal */}
      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('messages.createPlatformRequest')}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Platform Name"
              value={platformName}
              onChangeText={setPlatformName}
              maxLength={50}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={platformDescription}
              onChangeText={setPlatformDescription}
              multiline
              numberOfLines={4}
              maxLength={200}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  setPlatformName('');
                  setPlatformDescription('');
                }}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.applyBtn,
                  submittingPlatform && { opacity: 0.5 },
                ]}
                onPress={handleCreatePlatform}
                disabled={submittingPlatform}
              >
                {submittingPlatform ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.applyText}>
                    {t('messages.submitRequest')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Requests Modal */}
      <Modal
        transparent={false}
        visible={showRequestsModal}
        animationType="slide"
      >
        <Requests onClose={() => setShowRequestsModal(false)} />
      </Modal>

      {/* Friends Modal */}
      <Modal
        transparent={false}
        visible={showFriendsModal}
        animationType="slide"
      >
        <View style={styles.friendsModalContainer}>
          <View style={styles.friendsHeader}>
            <TouchableOpacity onPress={() => setShowFriendsModal(false)}>
              <Icon name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.friendsHeaderTitle}>
              {t('messages.addFriends')}
            </Text>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder={t('messages.searchUsersPlaceholder')}
            value={userSearch}
            onChangeText={setUserSearch}
          />

          {loadingFriends && (
            <ActivityIndicator size="small" color={COLORS.light.primary} />
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
                <View style={styles.userItem}>
                  <Image
                    source={
                      item.avatar
                        ? { uri: item.avatar }
                        : d_assets.images.appLogo
                    }
                    style={styles.userAvatar}
                    defaultSource={d_assets.images.appLogo}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {item.firstName || ''} {item.lastName || ''}
                    </Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      (isRequestSent || isFriend) && {
                        backgroundColor: '#ccc',
                      },
                    ]}
                    onPress={() =>
                      isFriend
                        ? startChatWithFriend(item.id)
                        : !isRequestSent && sendFriendRequest(item.id)
                    }
                    disabled={isRequestSent}
                  >
                    <Text style={styles.actionText}>
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
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              !loadingFriends && (
                <Text style={styles.noResultsText}>
                  {userSearch.trim()
                    ? t('messages.noUsersFound')
                    : t('messages.noUsersAvailable')}
                </Text>
              )
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'flex-start' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingStart: 20,
    color: COLORS.light.primary,
    backgroundColor: COLORS.white,
    padding: 10,
    elevation: 1,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingStart: 20,
    marginBottom: 10,
    marginTop: 15,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    elevation: 0.4,
    padding: 12,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  lockBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  lastMessage: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  badge: {
    backgroundColor: COLORS.light.primary,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.light.primary,
    marginLeft: 8,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    elevation: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.light.primary,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    marginRight: 15,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#999',
  },
  applyBtn: {
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  applyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  friendsModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  friendsHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
    color: COLORS.light.primary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    margin: 16,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
    paddingHorizontal: 20,
  },
  infoBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e74c3c',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.light.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: COLORS.light.primary,
  },
});

/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Modal,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Keyboard,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';

import { pick, types, isCancel } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';

import { d_assets } from '../../configs/assets';
import { auth, db as firestoreDb } from '../auth/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

import styles from './chatWhatsAppStyle';

import { ENV } from '../../../../src/config/env';
import { bootstrapChat } from '../../../../src/chat/chatBootstrap';
import { listMessages } from '../../../../src/chat/localDb';
import {
  getSocketOrNull,
  joinChat,
  flushOutbox,
  sendMessage,
  emitTyping,
  deleteForAll as socketDeleteForAll,
  blockUser as socketBlockUser,
} from '../../../../src/chat/socket';
import { uploadFileToCDN } from '../../../../src/chat/upload';

import { useTranslation } from 'react-i18next';

type MsgType = 'text' | 'image' | 'audio' | 'file';

type MediaItem = {
  url: string;
  mime: string;
  name: string;
  size?: number;
  durationSec?: number;
};

type ReplySnapshot = {
  type: MsgType;
  text: string;
  senderName: string;
};

type MessageRow = {
  id: string;
  chatId: string;
  clientId?: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  type: MsgType;
  text?: string | null;
  caption?: string | null;
  media?: MediaItem[];
  replyToId?: string | null;
  replyToSnapshot?: ReplySnapshot | null;
  createdAt: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deletedForAll?: boolean;
  animatedValue?: Animated.Value;
};

type RouteParams = {
  chatId: string;
  chatName: string;
  chatAvatar?: string;
};

type ChatRoomProps = {
  route: { params: RouteParams };
  navigation: { goBack: () => void };
};

type RoomState = {
  id: string;
  members?: string[];
  admins?: string[];
  blockedUsers?: string[];
  isClosed?: boolean;
  isGroup?: boolean;
};

type MeState = {
  uid: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};

type MemberProfile = {
  uid: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
  isMe: boolean;
  isBlocked: boolean;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function makeClientId() {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export default function ChatRoom({ route, navigation }: ChatRoomProps) {
  const { t } = useTranslation();

  const { chatId, chatName, chatAvatar } = route.params;

  const flatRef = useRef<FlatList<MessageRow> | null>(null);

  const [me, setMe] = useState<MeState | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);

  const [items, setItems] = useState<MessageRow[]>([]);
  const itemsRef = useRef<MessageRow[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [input, setInput] = useState<string>('');
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);

  const [attachOpen, setAttachOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [menuMsg, setMenuMsg] = useState<MessageRow | null>(null);

  const [typingMap, setTypingMap] = useState<Record<string, { name: string; avatar: string }>>({});

  const [infoOpen, setInfoOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<MemberProfile[]>([]);

  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastSocketError, setLastSocketError] = useState<string>('');

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<MediaItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [composerImages, setComposerImages] = useState<{ uri: string; name: string; type: string; size: number }[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerCaption, setComposerCaption] = useState('');

  const [editMsg, setEditMsg] = useState<MessageRow | null>(null);

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const PAGE_SIZE = 120;
  const [loadedLimit, setLoadedLimit] = useState(PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedOldest, setReachedOldest] = useState(false);

  // ✅ Auto-scroll control (fix reply jump bouncing to bottom)
  const isAtBottomRef = useRef(true);
  const isJumpingRef = useRef(false);

  const isAdmin = useMemo(() => !!room?.admins?.includes(auth.currentUser?.uid || ''), [room]);

  const canWrite = useMemo(() => {
    const uid = auth.currentUser?.uid || '';
    if (!room) return true;
    if (room.isClosed) return false;
    if ((room.blockedUsers || []).includes(uid)) return false;
    return true;
  }, [room]);

  const scrollBottom = (animated = true) =>
    setTimeout(() => {
      flatRef.current?.scrollToEnd({ animated });
    }, 60);

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t('chat.now');
    }
  };

  const loadMeAndRoom = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const u = await getDoc(doc(firestoreDb, 'user_data', uid));
    const r = await getDoc(doc(firestoreDb, 'chatrooms', chatId));

    const uData: any = u.data() || {};
    const rData: any = r.data() || {};

    setMe({
      uid,
      firstName: String(uData.firstName || ''),
      lastName: String(uData.lastName || ''),
      avatar: String(uData.avatar || ''),
    });

    setRoom({
      id: chatId,
      members: Array.isArray(rData.members) ? rData.members : [],
      admins: Array.isArray(rData.admins) ? rData.admins : [],
      blockedUsers: Array.isArray(rData.blockedUsers) ? rData.blockedUsers : [],
      isClosed: !!rData.isClosed,
      isGroup: !!rData.isGroup,
    });
  };

  const reloadLocal = async (limitOverride?: number, keepPosition?: { anchorId: string; yOffset?: number }) => {
    const limit = typeof limitOverride === 'number' ? limitOverride : loadedLimit;

    const rows = await listMessages(chatId, limit);
    const withAnim: MessageRow[] = rows.map((m: any) => ({
      ...m,
      animatedValue: m.animatedValue || new Animated.Value(0),
    }));

    if (itemsRef.current.length > 0 && withAnim.length === itemsRef.current.length && limit > itemsRef.current.length) {
      setReachedOldest(true);
    }

    setItems(withAnim);

    if (!keepPosition) {
      // ✅ only autoscroll if user is already at bottom and NOT doing a reply jump
      setTimeout(() => {
        if (isAtBottomRef.current && !isJumpingRef.current) {
          flatRef.current?.scrollToEnd({ animated: false });
        }
      }, 50);
      return;
    }

    setTimeout(() => {
      try {
        const idx = withAnim.findIndex(m => m.id === keepPosition.anchorId);
        if (idx >= 0) {
          flatRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.2 });
        }
      } catch {}
    }, 60);
  };

  const loadOlderPage = async () => {
    if (loadingOlder || reachedOldest) return false;
    setLoadingOlder(true);
    try {
      const next = loadedLimit + PAGE_SIZE;
      setLoadedLimit(next);
      await reloadLocal(next);
      return true;
    } finally {
      setLoadingOlder(false);
    }
  };

  const pulseHighlight = (id: string) => {
    setHighlightId(id);
    highlightAnim.setValue(0);

    Animated.sequence([
      Animated.timing(highlightAnim, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 0, duration: 420, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 0, duration: 520, useNativeDriver: false }),
    ]).start(() => {
      setTimeout(() => setHighlightId(null), 250);
    });
  };

  const scrollToMessageIndex = (idx: number, id: string) => {
    try {
      flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
      setTimeout(() => pulseHighlight(id), 320);
    } catch {
      setTimeout(() => {
        try {
          flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
          setTimeout(() => pulseHighlight(id), 320);
        } catch {}
      }, 250);
    }
  };

  const scrollToMessageWithPagination = async (messageId: string) => {
    // ✅ prevent auto-scroll to bottom while jumping
    isJumpingRef.current = true;

    try {
      const initial = itemsRef.current;
      let idx = initial.findIndex(m => m.id === messageId);
      if (idx >= 0) {
        scrollToMessageIndex(idx, messageId);
        return;
      }

      let safety = 0;
      while (safety < 25) {
        safety++;

        const loaded = await loadOlderPage();
        const now = itemsRef.current;
        idx = now.findIndex(m => m.id === messageId);

        if (idx >= 0) {
          scrollToMessageIndex(idx, messageId);
          return;
        }

        if (!loaded || reachedOldest) break;
      }

      Alert.alert(t('chat.alertMessageTitle'), t('chat.originalNotFound'));
    } finally {
      // release after a short moment so highlight/scroll finishes smoothly
      setTimeout(() => {
        isJumpingRef.current = false;
      }, 900);
    }
  };

  useEffect(() => {
    let mounted = true;
    let s: any = null;

    const run = async () => {
      try {
        setSocketStatus('connecting');
        setLastSocketError('');

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

        await loadMeAndRoom();
        await reloadLocal(PAGE_SIZE);

        s = getSocketOrNull();
        if (!s) {
          setSocketStatus('disconnected');
          setLastSocketError('Socket not initialized.');
          return;
        }

        const onConnect = async () => {
          if (!mounted) return;
          setSocketStatus('connected');
          setLastSocketError('');
          await joinChat(chatId);
          await flushOutbox(chatId);
        };

        const onDisconnect = () => {
          if (!mounted) return;
          setSocketStatus('disconnected');
        };

        const onConnectError = (err: any) => {
          if (!mounted) return;
          const msg = String(err?.message || err || 'connect_error');
          setSocketStatus('disconnected');
          setLastSocketError(msg);
        };

        const onTyping = (p: any) => {
          if (!mounted) return;
          if (p.chatId !== chatId) return;
          if (p.uid === auth.currentUser?.uid) return;

          setTypingMap(prev => {
            const copy = { ...prev };
            if (!p.typing) delete copy[p.uid];
            else {
              copy[p.uid] = {
                name: p.name ? String(p.name) : t('chat.typing'),
                avatar: p.avatar ? String(p.avatar) : '',
              };
            }
            return copy;
          });
        };

        const refresh = async () => {
          if (!mounted) return;
          await reloadLocal();
        };

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);
        s.on('connect_error', onConnectError);
        s.on('typing:update', onTyping);

        s.on('msg:new', refresh);
        s.on('msg:ack', refresh);
        s.on('msg:deleted', refresh);
        s.on('msg:receipt', refresh);
        s.on('msg:edited', refresh);

        setSocketStatus(s.connected ? 'connected' : 'connecting');

        if (s.connected) {
          await joinChat(chatId);
          await flushOutbox(chatId);
        }
      } catch (e: any) {
        setSocketStatus('disconnected');
        setLastSocketError(e?.message || 'init failed');
      }
    };

    run();

    return () => {
      mounted = false;
      if (s) {
        s.off('connect');
        s.off('disconnect');
        s.off('connect_error');
        s.off('typing:update');
        s.off('msg:new');
        s.off('msg:ack');
        s.off('msg:deleted');
        s.off('msg:receipt');
        s.off('msg:edited');
      }
    };
  }, [chatId]);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (text: string) => {
    setInput(text);

    const myName = me ? `${me.firstName || ''} ${me.lastName || ''}`.trim() || t('chat.user') : t('chat.user');
    const myAvatar = me?.avatar || '';

    emitTyping(chatId, true, { name: myName, avatar: myAvatar });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(chatId, false), 900);
  };

  const createPan = (msg: MessageRow) =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dy) < 10,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) msg.animatedValue?.setValue(Math.min(g.dx, 90));
      },
      onPanResponderRelease: (_, g) => {
        const trigger = g.dx > 55;
        if (trigger) {
          setReplyTo(msg);
          Keyboard.dismiss();
        }
        if (msg.animatedValue) {
          Animated.spring(msg.animatedValue, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    });

  const openViewer = (media: MediaItem[], startIndex = 0) => {
    setViewerImages(media);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  };

  const sendText = async () => {
    const txt = input.trim();
    if (!txt || !me) return;

    if (editMsg) {
      const clientId = makeClientId();
      const payload = {
        type: 'text' as const,
        text: txt,
        editOf: editMsg.id,
        from: {
          uid: me.uid,
          name: `${me.firstName || ''} ${me.lastName || ''}`.trim() || t('chat.user'),
          avatar: me.avatar || '',
        },
      };

      setInput('');
      setEditMsg(null);

      try {
        await sendMessage(chatId, clientId, payload as any);
        await reloadLocal();
        scrollBottom(true);
        await flushOutbox(chatId);
      } catch (e: any) {
        Alert.alert(t('chat.editFailedTitle'), e?.message || t('chat.failed'));
      }
      return;
    }

    const clientId = makeClientId();
    const payload = {
      type: 'text' as const,
      text: txt,
      from: {
        uid: me.uid,
        name: `${me.firstName || ''} ${me.lastName || ''}`.trim() || t('chat.user'),
        avatar: me.avatar || '',
      },
      replyToId: replyTo?.id || null,
      replyToSnapshot: replyTo
        ? {
            type: replyTo.type,
            text: replyTo.text || replyTo.caption || t('chat.media'),
            senderName: replyTo.fromName,
          }
        : null,
    };

    setInput('');
    setReplyTo(null);

    try {
      await sendMessage(chatId, clientId, payload);
      await reloadLocal();
      scrollBottom(true);
      await flushOutbox(chatId);
    } catch (e: any) {
      Alert.alert(t('chat.sendFailedTitle'), e?.message || t('chat.queuedOffline'));
      await reloadLocal();
    }
  };

  const pickImages = async () => {
    try {
      setAttachOpen(false);

      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 0,
        includeBase64: false,
      });

      if (res.didCancel) return;
      const assets = res.assets || [];
      if (assets.length === 0) return;

      const imgs = assets
        .filter(a => !!a.uri)
        .map(a => ({
          uri: String(a.uri),
          name: String(a.fileName || `photo_${Date.now()}.jpg`),
          type: String(a.type || 'image/jpeg'),
          size: Number(a.fileSize || 0),
        }));

      setComposerImages(imgs);
      setComposerCaption('');
      setComposerOpen(true);
    } catch (e: any) {
      Alert.alert(t('chat.imagesTitle'), e?.message || t('chat.pickImagesFailed'));
    }
  };

  const pickFiles = async () => {
    try {
      setAttachOpen(false);

      const res = await pick({
        allowMultiSelection: true,
        type: [
          types.pdf,
          types.plainText,
          types.audio,
          types.doc,
          types.docx,
          types.ppt,
          types.pptx,
          types.xls,
          types.xlsx,
          types.allFiles,
        ],
      });

      const files = res.map(f => ({
        uri: f.uri,
        name: f.name ?? 'file',
        type: f.type ?? 'application/octet-stream',
        size: f.size ?? 0,
      }));

      if (files.length > 0) await sendFiles(files);
    } catch (e: any) {
      if (!isCancel(e)) Alert.alert(t('chat.filesTitle'), e?.message || t('chat.pickFilesFailed'));
    }
  };

  const sendFiles = async (files: { uri: string; name: string; type: string; size: number }[]) => {
    if (!me) return;

    const clientId = makeClientId();
    try {
      const uploaded: MediaItem[] = [];
      for (const f of files) {
        const url = await uploadFileToCDN({ uri: f.uri, name: f.name, type: f.type }, ENV.uploadKey);
        uploaded.push({ url, mime: f.type, name: f.name, size: f.size });
      }

      const payload = {
        type: 'file' as const,
        media: uploaded,
        caption: null,
        from: {
          uid: me.uid,
          name: `${me.firstName || ''} ${me.lastName || ''}`.trim() || t('chat.user'),
          avatar: me.avatar || '',
        },
        replyToId: replyTo?.id || null,
        replyToSnapshot: replyTo
          ? {
              type: replyTo.type,
              text: replyTo.text || replyTo.caption || t('chat.media'),
              senderName: replyTo.fromName,
            }
          : null,
      };

      setReplyTo(null);

      await sendMessage(chatId, clientId, payload);
      await reloadLocal();
      scrollBottom(true);
      await flushOutbox(chatId);
    } catch (e: any) {
      Alert.alert(t('chat.uploadErrorTitle'), e?.message || t('chat.uploadFailed'));
    }
  };

  const sendComposerImages = async () => {
    if (!me) return;
    if (composerImages.length === 0) return;

    const clientId = makeClientId();
    const caption = composerCaption.trim() || null;

    try {
      const uploaded: MediaItem[] = [];
      for (const f of composerImages) {
        const url = await uploadFileToCDN({ uri: f.uri, name: f.name, type: f.type }, ENV.uploadKey);
        uploaded.push({ url, mime: f.type, name: f.name, size: f.size });
      }

      const payload = {
        type: 'image' as const,
        media: uploaded,
        caption,
        from: {
          uid: me.uid,
          name: `${me.firstName || ''} ${me.lastName || ''}`.trim() || t('chat.user'),
          avatar: me.avatar || '',
        },
        replyToId: replyTo?.id || null,
        replyToSnapshot: replyTo
          ? {
              type: replyTo.type,
              text: replyTo.text || replyTo.caption || t('chat.media'),
              senderName: replyTo.fromName,
            }
          : null,
      };

      setComposerOpen(false);
      setComposerImages([]);
      setComposerCaption('');
      setReplyTo(null);

      await sendMessage(chatId, clientId, payload);
      await reloadLocal();
      scrollBottom(true);
      await flushOutbox(chatId);
    } catch (e: any) {
      Alert.alert(t('chat.uploadErrorTitle'), e?.message || t('chat.uploadFailed'));
    }
  };

  const deleteForAll = (msg: MessageRow) => {
    socketDeleteForAll(chatId, msg.id);
    setMenuOpen(false);
  };

  const deleteForMe = (msg: MessageRow) => {
    setItems(prev => prev.filter(m => m.id !== msg.id));
    setMenuOpen(false);
  };

  const renderReceipt = (status: MessageRow['status']) => {
    if (status === 'pending') return <Ionicons name="time-outline" size={14} color="#94A3B8" />;
    if (status === 'sent') return <Ionicons name="checkmark" size={16} color="#94A3B8" />;
    if (status === 'delivered') return <Ionicons name="checkmark-done" size={16} color="#94A3B8" />;
    if (status === 'read') return <Ionicons name="checkmark-done" size={16} color="#2FA5A9" />;
    return <Ionicons name="alert-circle-outline" size={16} color="#F43F5E" />;
  };

  const replyPreview = () => {
    if (!replyTo) return null;
    const who = replyTo.fromUid === auth.currentUser?.uid ? t('chat.you') : replyTo.fromName || t('chat.user');
    const text =
      replyTo.type === 'text'
        ? (replyTo.text || '')
        : replyTo.type === 'image'
          ? t('chat.photo')
          : replyTo.type === 'audio'
            ? t('chat.voiceNote')
            : t('chat.file');

    return (
      <View style={styles.replyPreview}>
        <View style={{ flex: 1 }}>
          <Text style={styles.replyPreviewTitle} numberOfLines={1}>
            {t('chat.replyingTo', { name: who })}
          </Text>
          <Text style={styles.replyPreviewText} numberOfLines={1}>
            {text || t('chat.media')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyClose}>
          <Ionicons name="close" size={18} color="#334155" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderImageGrid = (media: MediaItem[], caption?: string | null) => {
    const imgs = media || [];
    if (imgs.length === 0) return null;

    const show = imgs.slice(0, 4);
    const remaining = imgs.length - show.length;

    const onPress = (idx: number) => openViewer(imgs, idx);

    const Cell = ({ idx, style }: { idx: number; style: any }) => (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(idx)} style={style}>
        <Image source={{ uri: show[idx].url }} style={styles.gridImg} />
        {idx === 3 && remaining > 0 ? (
          <View style={styles.moreOverlay}>
            <Text style={styles.moreText}>+{remaining}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );

    return (
      <View style={styles.imageWrap}>
        {show.length === 1 ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(0)} style={styles.oneImgBox}>
            <Image source={{ uri: show[0].url }} style={styles.oneImg} />
          </TouchableOpacity>
        ) : show.length === 2 ? (
          <View style={styles.twoRow}>
            <Cell idx={0} style={styles.twoCell} />
            <Cell idx={1} style={styles.twoCell} />
          </View>
        ) : show.length === 3 ? (
          <View style={styles.threeRow}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(0)} style={styles.threeLeft}>
              <Image source={{ uri: show[0].url }} style={styles.gridImg} />
            </TouchableOpacity>
            <View style={styles.threeRightCol}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(1)} style={styles.threeRightCell}>
                <Image source={{ uri: show[1].url }} style={styles.gridImg} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(2)} style={styles.threeRightCell}>
                <Image source={{ uri: show[2].url }} style={styles.gridImg} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.fourGrid}>
            <Cell idx={0} style={styles.fourCell} />
            <Cell idx={1} style={styles.fourCell} />
            <Cell idx={2} style={styles.fourCell} />
            <Cell idx={3} style={styles.fourCell} />
          </View>
        )}

        {caption ? <Text style={styles.msgText}>{caption}</Text> : null}
      </View>
    );
  };

  const renderLoadingOlder = () => {
    if (!loadingOlder) return null;
    return (
      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <View style={styles.connPill}>
          <ActivityIndicator />
          <Text style={styles.connPillText}>{t('chat.loadingOlder')}</Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: MessageRow }) => {
    const isMeMsg = item.fromUid === auth.currentUser?.uid;
    const pan = createPan(item);

    const isHighlighted = highlightId === item.id;

    const highlightBg = highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0)', 'rgba(255,214,10,0.22)'],
    });

    return (
      <Animated.View
        {...pan.panHandlers}
        style={{
          transform: [{ translateX: item.animatedValue || new Animated.Value(0) }],
          backgroundColor: isHighlighted ? (highlightBg as any) : 'transparent',
          borderRadius: 14,
          paddingVertical: isHighlighted ? 4 : 0,
        }}
      >
        <View style={[styles.row, isMeMsg ? styles.rowRight : styles.rowLeft]}>
          {!isMeMsg && (
            <Image source={item.fromAvatar ? { uri: item.fromAvatar } : d_assets.images.appLogo} style={styles.avatar} />
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => {
              setMenuMsg(item);
              setMenuOpen(true);
            }}
            style={[styles.bubble, isMeMsg ? styles.bubbleMe : styles.bubbleOther]}
          >
            {!isMeMsg ? <Text style={styles.name}>{item.fromName || t('chat.user')}</Text> : null}

            {item.replyToId && item.replyToSnapshot ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => scrollToMessageWithPagination(item.replyToId!)}
                style={styles.replyChip}
              >
                <Text style={styles.replyName}>{item.replyToSnapshot.senderName || t('chat.reply')}</Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {item.replyToSnapshot.text || t('chat.media')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {item.deletedForAll ? (
              <Text style={styles.deletedText}>{t('chat.thisMessageDeleted')}</Text>
            ) : (
              <>
                {item.type === 'image' && (item.media || []).length > 0 ? renderImageGrid(item.media || [], item.caption) : null}

                {item.type === 'file' && (item.media || []).length > 0 ? (
                  <View style={styles.fileBox}>
                    <Ionicons name="document-text-outline" size={18} color={isMeMsg ? '#fff' : '#111'} />
                    <Text style={[styles.fileName, isMeMsg && { color: '#fff' }]} numberOfLines={1}>
                      {item.media?.[0]?.name || t('chat.document')}
                    </Text>
                  </View>
                ) : null}

                {item.type === 'text' && item.text ? (
                  <Text style={[styles.msgText, isMeMsg && { color: '#fff' }]}>{item.text}</Text>
                ) : null}
              </>
            )}

            <View style={styles.meta}>
              <Text style={[styles.time, !isMeMsg && { color: '#64748B' }]}>{formatTime(item.createdAt)}</Text>
              {isMeMsg ? <View style={{ marginLeft: 6 }}>{renderReceipt(item.status)}</View> : null}
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.hCenter} activeOpacity={0.9}>
          <Image source={chatAvatar ? { uri: chatAvatar } : d_assets.images.appLogo} style={styles.hAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hTitle} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={styles.hSub} numberOfLines={1}>
              {Object.keys(typingMap).length > 0
                ? t('chat.typing')
                : t('chat.members', { count: room?.members?.length || 0 })}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hBtn} onPress={() => setAttachOpen(true)}>
          <Ionicons name="add-circle-outline" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      {renderLoadingOlder()}

      <ImageBackground
        source={d_assets.images.chatBg}
        style={styles.chatBg}
        resizeMode={Platform.OS === 'ios' ? 'repeat' : 'repeat'}
        imageStyle={[styles.chatBgImg, Platform.OS === 'android' ? { opacity: 0.22 } : null]}
      >
        <FlatList
          ref={flatRef as any}
          data={items}
          keyExtractor={it => it.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 12, paddingBottom: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // ✅ track bottom position + prevent unwanted jumps
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            const padding = 40;
            const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - padding;
            isAtBottomRef.current = atBottom;
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              try {
                flatRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 });
              } catch {}
            }, 250);
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {replyPreview()}
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.iconChip} onPress={() => setAttachOpen(true)} disabled={!canWrite}>
              <Ionicons name="add" size={20} color="#111" />
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              <TextInput
                value={input}
                onChangeText={onType}
                placeholder={canWrite ? t('chat.placeholderMessage') : t('chat.placeholderCantWrite')}
                placeholderTextColor="#94A3B8"
                style={styles.input}
                multiline
                editable={canWrite}
              />
            </View>

            {input.trim().length > 0 ? (
              <TouchableOpacity style={styles.sendBtn} onPress={sendText} disabled={!canWrite}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.micBtn} onPress={() => setAttachOpen(true)} disabled={!canWrite}>
                <Ionicons name="attach-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>

      <Modal transparent visible={attachOpen} animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAttachOpen(false)}>
          <View style={styles.attachCard}>
            <TouchableOpacity style={styles.attachRow} onPress={pickImages}>
              <Ionicons name="image-outline" size={20} color="#111" />
              <Text style={styles.attachText}>{t('chat.attachPhotos')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachRow} onPress={pickFiles}>
              <Ionicons name="document-outline" size={20} color="#111" />
              <Text style={styles.attachText}>{t('chat.attachFilesDocuments')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.composerTop}>
            <TouchableOpacity onPress={() => setComposerOpen(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {t('chat.photosCount', { count: composerImages.length })}
            </Text>

            <View style={{ width: 32 }} />
          </View>

          <FlatList
            data={composerImages}
            keyExtractor={(it, idx) => it.uri + idx}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, height: SCREEN_H * 0.65, justifyContent: 'center' }}>
                <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
              </View>
            )}
          />

          <View style={styles.composerBottom}>
            <TextInput
              value={composerCaption}
              onChangeText={setComposerCaption}
              placeholder={t('chat.addCaption')}
              placeholderTextColor="#94A3B8"
              style={styles.composerCaption}
              multiline
            />
            <TouchableOpacity style={styles.composerSend} onPress={sendComposerImages}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={viewerOpen} animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.viewerTop}>
            <TouchableOpacity onPress={() => setViewerOpen(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {viewerIndex + 1}/{viewerImages.length}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <FlatList
            data={viewerImages}
            keyExtractor={(it, idx) => it.url + idx}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setViewerIndex(i);
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, height: SCREEN_H * 0.8, justifyContent: 'center' }}>
                <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Menu modal omitted here to keep message shorter; keep yours unchanged */}
    </SafeAreaView>
  );
}

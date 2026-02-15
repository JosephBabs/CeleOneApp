// PostDetailPro.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Dimensions,
} from 'react-native';
import Modal from 'react-native-modal';
import ImageViewer from 'react-native-image-zoom-viewer';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';

import { getFunctions, httpsCallable } from 'firebase/functions';

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { d_assets } from '../../configs/assets';

type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'video'; url: string; poster?: string };

type PostDoc = {
  id: string;
  text?: string;
  title?: string;
  content?: string;

  originalLang?: string; // e.g. 'fr'
  translations?: Record<string, string>;

  media?: MediaItem[]; // recommended
  image?: any; // legacy
  video?: string; // legacy

  author?: string;
  posterName?: string;
  user?: { profileImage?: string };

  createdAt?: any;

  likeCount?: number;
  likes?: number;
  commentCount?: number;
  shareCount?: number;

  likedBy?: string[]; // ✅ for like logic

  shareLink?: string;
};

type CommentDoc = {
  id: string;
  parentId: string | null; // null = root
  rootId?: string | null; // optional
  text: string;
  userId: string;
  userEmail?: string;
  userName: string;
  userProfileImage?: string;
  createdAt?: any;
  updatedAt?: any;
};

type TreeNode = CommentDoc & { children: TreeNode[] };

const { width } = Dimensions.get('window');

function timeAgo(ts: any) {
  if (!ts) return 'now';
  const now = new Date();
  const d = ts.toDate?.() || new Date(ts);
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  const w = Math.floor(day / 7);
  if (w < 52) return `${w}w`;
  const y = Math.floor(day / 365);
  return `${y}y`;
}

function buildTree(list: CommentDoc[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  list.forEach(c => map.set(c.id, { ...c, children: [] }));

  const roots: TreeNode[] = [];
  map.forEach(node => {
    if (!node.parentId) roots.push(node);
    else {
      const parent = map.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan safety
    }
  });

  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => {
      const ad = a.createdAt?.toDate?.()?.getTime?.() || 0;
      const bd = b.createdAt?.toDate?.()?.getTime?.() || 0;
      return ad - bd;
    });
    arr.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function detectMedia(post: PostDoc): MediaItem[] {
  if (Array.isArray(post.media) && post.media.length) return post.media;
  if (post.video) return [{ type: 'video', url: post.video }];

  const img = (post as any).image;
  if (typeof img === 'string' && img) return [{ type: 'image', url: img }];
  if (Array.isArray(img) && img.length) {
    return img.map((x: any) => ({ type: 'image', url: x?.uri || x }));
  }
  return [];
}

export default function PostDetailPro({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { post } = route.params as { post: PostDoc };

  const [postData, setPostData] = useState<PostDoc>({ ...post });
  const postId = post.id;

  // Translation
  const [showOriginal, setShowOriginal] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Like
  const [isLiked, setIsLiked] = useState(false);

  // Media viewer
  const [imageModal, setImageModal] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  // Comments
  const [commentsModal, setCommentsModal] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [flatComments, setFlatComments] = useState<CommentDoc[]>([]);
  const commentTree = useMemo(() => buildTree(flatComments), [flatComments]);

  // ✅ Replies toggle (auto hidden)
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  // Composer
  const inputRef = useRef<TextInput>(null);
  const [composerText, setComposerText] = useState('');
  const [replyTarget, setReplyTarget] = useState<null | { id: string; userName: string }>(null);

  // Actions sheet (edit/delete)
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CommentDoc | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
  const email = currentUser?.email || '';

  // ✅ realtime post (keeps likeCount/commentCount fresh + likedBy)
  useEffect(() => {
    const ref = doc(db, 'posts', postId);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = { id: postId, ...(snap.data() as any) } as PostDoc;
        setPostData(data);
        const liked = (data.likedBy || []).includes(email);
        setIsLiked(liked);
      }
    });
    return () => unsub();
  }, [postId, email]);

  // Realtime comments
  useEffect(() => {
    const qy = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      qy,
      snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as CommentDoc[];
        setFlatComments(arr);
        setLoadingComments(false);
      },
      err => {
        console.log('comments listener error:', err);
        setLoadingComments(false);
      },
    );
    return () => unsub();
  }, [postId]);

  const media = useMemo(() => detectMedia(postData), [postData]);

  const originalText = useMemo(() => {
    return postData.text || postData.content || postData.title || '';
  }, [postData]);

  const userLang = useMemo(() => (i18n.language || 'en').toLowerCase(), [i18n.language]);
  const normalizedUserLang = useMemo(() => {
    if (userLang.startsWith('en')) return 'en';
    if (userLang.startsWith('fr')) return 'fr';
    if (userLang.startsWith('es')) return 'es';
    if (userLang.startsWith('yo')) return 'yo';
    if (userLang.startsWith('gou')) return 'gou';
    if (userLang.startsWith('fon')) return 'fon';
    return 'en';
  }, [userLang]);

  const originLang = postData.originalLang || 'en';
  const translatedText = postData.translations?.[normalizedUserLang];

  const finalTextToShow = useMemo(() => {
    if (showOriginal) return originalText;
    if (originLang === normalizedUserLang) return originalText;
    return translatedText || originalText;
  }, [showOriginal, originalText, translatedText, originLang, normalizedUserLang]);

  const canTranslate = useMemo(() => {
    return !!originalText && originLang !== normalizedUserLang;
  }, [originalText, originLang, normalizedUserLang]);

  // ✅ accurate comment total: includes replies because replies are also docs in flatComments
  const totalComments = useMemo(() => flatComments.length, [flatComments.length]);

  // ---- Share
  const handleShare = async () => {
    const link = postData.shareLink || `https://celeonetv.com/post/${postId}`;
    try {
      await Share.share({
        message: `${postData.title ? postData.title + '\n\n' : ''}${link}`,
      });
      // optional
      // await updateDoc(doc(db, 'posts', postId), { shareCount: (postData.shareCount || 0) + 1 });
    } catch {}
  };

  // ✅ Like logic (likedBy + likeCount)
  const handleLike = async () => {
    if (!uid || !email) {
      Alert.alert(t('common.error') || 'Error', t('post.must_login') || 'You must be logged in');
      return;
    }
    try {
      const ref = doc(db, 'posts', postId);
      const already = (postData.likedBy || []).includes(email);

      if (already) {
        await updateDoc(ref, {
          likedBy: arrayRemove(email),
          likeCount: Math.max(0, (postData.likes || 0) - 1),
        });
      } else {
        await updateDoc(ref, {
          likedBy: arrayUnion(email),
          likeCount: (postData.likes || 0) + 1,
        });
      }
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', t('post.like_failed') || 'Failed to update like');
    }
  };

  // ---- Translate request pattern
  const requestTranslation = async () => {
    if (!canTranslate) return;
    if (translatedText) return;
    setTranslating(true);
    try {
      await setDoc(doc(db, 'posts', postId, 'translation_requests', normalizedUserLang), {
        targetLang: normalizedUserLang,
        sourceLang: originLang,
        text: originalText,
        createdAt: serverTimestamp(),
        requestedBy: uid || null,
      });

      Alert.alert(
        t('post.translation_requested_title') || 'Translation requested',
        t('post.translation_requested_body') || 'It will appear automatically in a moment.',
      );
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', t('post.translation_failed') || 'Failed to request translation.');
    } finally {
      setTranslating(false);
    }
  };

  // ---- comment helpers
  const ensureUserMeta = async () => {
    if (!currentUser) throw new Error('no user');
    const u = currentUser;
    const userSnap = await getDoc(doc(db, 'user_data', u.uid));
    const data = userSnap.exists() ? userSnap.data() : {};
    return {
      userId: u.uid,
      userEmail: u.email || '',
      userName: `${data.firstName || 'User'} ${data.lastName || ''}`.trim(),
      userProfileImage: data?.profileImage || data?.photoURL || '',
    };
  };

  const openComments = () => {
    setCommentsModal(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const focusReply = (id: string, userName: string) => {
    setReplyTarget({ id, userName });
    setCommentsModal(true);
    setTimeout(() => inputRef.current?.focus(), 350);
  };

  const cancelReply = () => setReplyTarget(null);

  const submitComment = async () => {
    if (!composerText.trim()) {
      Alert.alert(t('post.validation') || 'Validation', t('post.write_comment') || 'Please write a comment');
      return;
    }
    if (!currentUser) {
      Alert.alert(t('common.error') || 'Error', t('post.must_login') || 'You must be logged in');
      return;
    }

    try {
      const meta = await ensureUserMeta();
      const parentId = replyTarget?.id || null;

      await addDoc(collection(db, 'posts', postId, 'comments'), {
        parentId,
        rootId: parentId ? replyTarget?.id : null,
        text: composerText.trim(),
        ...meta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // optional: keep commentCount in post doc consistent
      // await updateDoc(doc(db,'posts',postId), { commentCount: (postData.commentCount || 0) + 1 });

      setComposerText('');
      setReplyTarget(null);
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', t('post.comment_failed') || 'Failed to post comment');
    }
  };

  const openActions = (item: CommentDoc) => {
    setEditingItem(item);
    setEditText(item.text);
    setEditMode(false);
    setActionSheetVisible(true);
  };

  const doEdit = async () => {
    if (!editingItem) return;
    if (!editText.trim()) {
      Alert.alert(t('post.validation') || 'Validation', t('post.comment_empty') || 'Comment cannot be empty');
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', postId, 'comments', editingItem.id), {
        text: editText.trim(),
        updatedAt: serverTimestamp(),
      });
      setActionSheetVisible(false);
      setEditMode(false);
      setEditingItem(null);
    } catch {
      Alert.alert(t('common.error') || 'Error', t('post.edit_failed') || 'Failed to edit');
    }
  };

  const doDelete = async () => {
    if (!editingItem) return;
    Alert.alert(
      t('post.delete_title') || 'Delete',
      t('post.delete_confirm') || 'Delete this comment?',
      [
        { text: t('common.close') || 'Cancel', style: 'cancel' },
        {
          text: t('post.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', postId, 'comments', editingItem.id));
              setActionSheetVisible(false);
              setEditMode(false);
              setEditingItem(null);
            } catch {
              Alert.alert(t('common.error') || 'Error', t('post.delete_failed') || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const isOwner = (c: CommentDoc) => c.userId && c.userId === uid;

  // ---- media viewer helper (only images)
  const imageOnly = useMemo(() => media.filter(m => m.type === 'image') as { type: 'image'; url: string }[], [media]);
  const zoomImages = useMemo(() => imageOnly.map(m => ({ url: m.url })), [imageOnly]);

  const openImageAt = (idx: number) => {
    setImageIndex(idx);
    setImageModal(true);
  };

  // ✅ replies expand/collapse (root only)
  const toggleReplies = (rootId: string) => {
    setExpandedRoots(prev => {
      const n = new Set(prev);
      if (n.has(rootId)) n.delete(rootId);
      else n.add(rootId);
      return n;
    });
  };

  // ---- render comment node
  const renderNode = (node: TreeNode, depth = 0) => {
    const padLeft = 14 + Math.min(depth, 6) * 18;

    const isRoot = depth === 0;
    const hasReplies = (node.children?.length || 0) > 0;
    const expanded = expandedRoots.has(node.id);

    return (
      <View key={node.id} style={{ paddingLeft: padLeft, paddingRight: 14, marginTop: 10 }}>
        <View style={styles.commentRow}>
          <Image
            source={node.userProfileImage ? { uri: node.userProfileImage } : d_assets.images.appLogo}
            style={styles.cAvatar}
          />

          <View style={styles.cBubble}>
            <View style={styles.cTop}>
              <Text style={styles.cName} numberOfLines={1}>
                {node.userName}
              </Text>

              {isOwner(node) && (
                <TouchableOpacity onPress={() => openActions(node)} style={styles.cMenuBtn}>
                  <Icon name="ellipsis-horizontal" size={16} color="#7A7A7A" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.cText}>{node.text}</Text>

            <View style={styles.cMeta}>
              <Text style={styles.cTime}>{timeAgo(node.createdAt)}</Text>

              <TouchableOpacity onPress={() => focusReply(node.id, node.userName)}>
                <Text style={styles.cReply}>{t('post.reply') || 'Reply'}</Text>
              </TouchableOpacity>

              {/* ✅ show/hide replies toggle ONLY for root comments */}
              {isRoot && hasReplies && (
                <TouchableOpacity onPress={() => toggleReplies(node.id)}>
                  <Text style={[styles.cReply, { color: '#111' }]}>
                    {expanded
                      ? (t('post.hide_replies') || 'Hide replies')
                      : `${t('post.view_replies') || 'View replies'} (${node.children.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ✅ children auto hidden */}
        {(depth > 0 || expanded) &&
          node.children?.map(child => renderNode(child, depth + 1))}
      </View>
    );
  };

  // ---- Header data
  const authorName = postData.author || postData.posterName || t('post.unknown') || 'Unknown';
  const authorAvatar =
    typeof postData.user?.profileImage === 'string'
      ? { uri: postData.user.profileImage }
      : postData.user?.profileImage
      ? postData.user.profileImage
      : d_assets.images.appLogo;

  return (
    <View style={styles.screen}>
      {/* Luxury top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Icon name="chevron-back" size={24} color="#0E0E10" />
        </TouchableOpacity>

        <Text style={styles.topTitle} numberOfLines={1}>
          {t('post.post') || 'Post'}
        </Text>

        <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
          <Icon name="share-social-outline" size={20} color="#0E0E10" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.card}>
          {/* author row */}
          <View style={styles.authorRow}>
            <Image source={authorAvatar as any} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>
                {authorName}
              </Text>
              <Text style={styles.metaLine}>
                {(postData.createdAt?.toDate?.()?.toLocaleDateString?.() || t('post.recently') || 'recently')}{' '}
                · <Text style={{ opacity: 0.9 }}>🌍</Text>
                {postData.originalLang ? ` · ${postData.originalLang.toUpperCase()}` : ''}
              </Text>
            </View>

            {canTranslate && (
              <TouchableOpacity
                onPress={() => setShowOriginal(s => !s)}
                style={[styles.pill, { backgroundColor: showOriginal ? '#111' : '#F2F3F5' }]}
              >
                <Icon name="language" size={14} color={showOriginal ? '#fff' : '#111'} />
                <Text style={[styles.pillText, { color: showOriginal ? '#fff' : '#111' }]}>
                  {showOriginal ? (t('post.show_translated') || 'Translated') : (t('post.show_original') || 'Original')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* text */}
          <Text style={styles.postText}>{finalTextToShow}</Text>

          {/* translate CTA when missing */}
          {canTranslate && !showOriginal && !translatedText && (
            <TouchableOpacity
              onPress={requestTranslation}
              style={[styles.translateBtn, translating && { opacity: 0.7 }]}
              disabled={translating}
            >
              {translating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="sparkles-outline" size={16} color="#fff" />
                  <Text style={styles.translateBtnText}>
                    {t('post.translate_to') || 'Translate to'} {normalizedUserLang.toUpperCase()}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* media */}
          {media.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {media[0].type === 'video' ? (
                <View style={styles.videoWrap}>
                  <Video
                    source={{ uri: (media[0] as any).url }}
                    style={styles.video}
                    poster={(media[0] as any).poster}
                    posterResizeMode="cover"
                    resizeMode="cover"
                    controls
                  />
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 14 }}>
                  {imageOnly.map((m, idx) => (
                    <TouchableOpacity key={idx} onPress={() => openImageAt(idx)} activeOpacity={0.9}>
                      <Image source={{ uri: m.url }} style={styles.mediaImg} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* metrics */}
          <View style={styles.metricsRow}>
            <Text style={styles.metricsText}>❤️ {postData.likes || 0}</Text>
            <Text style={styles.metricsText}>
              {totalComments} {t('post.comments') || 'comments'} · {postData.shareCount || 0} {t('post.shares') || 'shares'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Icon name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#E74C3C' : '#5B5B5E'} />
              <Text style={[styles.actionText, isLiked && { color: '#E74C3C' }]}>{t('post.like') || 'Like'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={openComments}>
              <Icon name="chatbubble-outline" size={20} color="#5B5B5E" />
              <Text style={styles.actionText}>{t('post.comment') || 'Comment'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Icon name="share-social-outline" size={20} color="#5B5B5E" />
              <Text style={styles.actionText}>{t('post.share') || 'Share'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Image zoom viewer */}
      <Modal isVisible={imageModal} onBackdropPress={() => setImageModal(false)} style={{ margin: 0, backgroundColor: '#000' }}>
        <ImageViewer imageUrls={zoomImages} index={imageIndex} enableSwipeDown onCancel={() => setImageModal(false)} backgroundColor="#000" />
      </Modal>

      {/* Comments modal */}
      <Modal isVisible={commentsModal} onBackdropPress={() => setCommentsModal(false)} style={{ margin: 0, justifyContent: 'flex-end' }}>
        <View style={styles.commentsSheet}>
          {/* header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('post.comments') || 'Comments'}</Text>
              <Text style={styles.sheetSub}>
                {totalComments} {t('post.total') || 'total'}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setCommentsModal(false)} style={styles.sheetClose}>
              <Icon name="close" size={20} color="#111" />
            </TouchableOpacity>
          </View>

          {/* reply banner */}
          {!!replyTarget && (
            <View style={styles.replyBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="return-down-forward" size={16} color="#111" />
                <Text style={styles.replyBannerText}>
                  {t('post.replying_to') || 'Replying to'} <Text style={{ fontWeight: '900' }}>{replyTarget.userName}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.replyCancel}>
                <Text style={{ fontWeight: '900', color: '#111' }}>{t('post.cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* list */}
          <View style={{ flex: 1 }}>
            {loadingComments ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.light.primary} />
              </View>
            ) : commentTree.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                <Text style={{ color: '#777', textAlign: 'center', fontWeight: '700' }}>
                  {t('post.no_comments') || 'No comments yet. Be the first to comment!'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {commentTree.map(n => renderNode(n, 0))}
                <View style={{ height: 14 }} />
              </ScrollView>
            )}
          </View>

          {/* composer */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.composer}>
              <TextInput
                ref={inputRef}
                value={composerText}
                onChangeText={setComposerText}
                placeholder={replyTarget ? (t('post.write_reply') || 'Write a reply…') : (t('post.write_comment') || 'Write a comment…')}
                placeholderTextColor="#8C8C8F"
                style={styles.input}
                multiline
                maxLength={800}
              />
              <TouchableOpacity style={styles.send} onPress={submitComment} activeOpacity={0.9}>
                <Icon name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Actions sheet (edit/delete) */}
      <Modal
        isVisible={actionSheetVisible}
        onBackdropPress={() => {
          setActionSheetVisible(false);
          setEditMode(false);
        }}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={styles.actionSheet}>
          {!editMode ? (
            <>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>{t('post.comment_options') || 'Comment options'}</Text>
                <TouchableOpacity onPress={() => setActionSheetVisible(false)}>
                  <Icon name="close" size={20} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.actionRowBtn} onPress={() => setEditMode(true)}>
                <Icon name="pencil-outline" size={20} color="#007AFF" />
                <Text style={[styles.actionRowText, { color: '#007AFF' }]}>{t('post.edit') || 'Edit'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRowBtn} onPress={doDelete}>
                <Icon name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.actionRowText, { color: '#FF3B30' }]}>{t('post.delete') || 'Delete'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionRowBtn, { justifyContent: 'center' }]} onPress={() => setActionSheetVisible(false)}>
                <Text style={[styles.actionRowText, { color: '#999' }]}>{t('post.cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>{t('post.edit_comment') || 'Edit comment'}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditMode(false);
                    setEditText(editingItem?.text || '');
                  }}
                >
                  <Icon name="close" size={20} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 16 }}>
                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  style={styles.editInput}
                  placeholder={t('post.edit_placeholder') || 'Edit your comment…'}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#F2F3F5' }]}
                  onPress={() => {
                    setEditMode(false);
                    setEditText(editingItem?.text || '');
                  }}
                >
                  <Text style={{ fontWeight: '900', color: '#555' }}>{t('post.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: COLORS.light.primary }]} onPress={doEdit}>
                  <Text style={{ fontWeight: '900', color: '#fff' }}>{t('post.save') || 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F5F7' },

  topBar: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEDEF',
  },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontWeight: '900', fontSize: 16, color: '#0E0E10' },

  card: {
    marginTop: 14,
    marginHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#F2F3F5' },
  authorName: { fontWeight: '900', color: '#111', fontSize: 15 },
  metaLine: { marginTop: 2, fontWeight: '700', fontSize: 12, color: '#75757A' },

  pill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { fontWeight: '900', fontSize: 12 },

  postText: {
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: '600',
    color: '#121316',
  },

  translateBtn: {
    marginTop: 12,
    marginHorizontal: 14,
    backgroundColor: '#111',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  translateBtnText: { color: '#fff', fontWeight: '900' },

  mediaImg: {
    width: Math.min(260, width * 1),
    height: 170,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#F2F3F5',
  },

  videoWrap: { marginHorizontal: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', height: 220 },
  video: { width: '100%', height: '100%' },

  metricsRow: { marginTop: 14, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between' },
  metricsText: { fontWeight: '800', fontSize: 12.5, color: '#6B6B70' },

  divider: { height: 1, backgroundColor: '#ECEDEF', marginTop: 12, marginHorizontal: 14 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  actionText: { fontWeight: '900', color: '#5B5B5E' },

  commentsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, height: '86%', overflow: 'hidden' },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sheetSub: { marginTop: 2, fontSize: 12, fontWeight: '800', color: '#777' },
  sheetClose: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F3F5' },

  replyBanner: { backgroundColor: '#F2F3F5', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  replyBannerText: { fontWeight: '800', color: '#111' },
  replyCancel: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#fff' },

  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#F2F3F5' },

  cBubble: { flex: 1, backgroundColor: '#F6F7F9', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  cTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cName: { fontWeight: '900', color: '#111', flex: 1 },
  cMenuBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cText: { marginTop: 6, fontWeight: '600', color: '#1A1A1D', lineHeight: 20 },
  cMeta: { marginTop: 8, flexDirection: 'row', gap: 14, alignItems: 'center' },
  cTime: { fontWeight: '800', fontSize: 12, color: '#777' },
  cReply: { fontWeight: '900', fontSize: 12, color: COLORS.light.primary },

  composer: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EEEFF2', flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: '#F6F7F9', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontWeight: '700', color: '#111' },
  send: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.light.primary, alignItems: 'center', justifyContent: 'center' },

  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 18 },
  actionHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEEFF2', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '900', color: '#111' },
  actionRowBtn: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F2F3F5' },
  actionRowText: { fontWeight: '900', fontSize: 15 },

  editInput: { borderWidth: 1, borderColor: '#E6E7EA', borderRadius: 14, padding: 12, minHeight: 90, textAlignVertical: 'top', fontWeight: '700' },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});

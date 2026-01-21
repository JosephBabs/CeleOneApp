import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
import ImageViewer from 'react-native-image-zoom-viewer';
import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { d_assets } from '../../configs/assets';

export default function PostDetail({ route, navigation }: any) {
  const { t } = useTranslation();
  const { post } = route.params;

  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showFullText, setShowFullText] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState(new Set<string>());
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postData, setPostData] = useState<any>(post);
  const [isLiked, setIsLiked] = useState(false);

  // State for edit/delete modal
  const [showCommentMenuModal, setShowCommentMenuModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);
  const [editingText, setEditingText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch comments from Firebase
  useEffect(() => {
    fetchComments();
    checkIfUserLiked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const commentsQuery = query(collection(db, 'posts', post.id, 'comments'));
      const unsubscribe = onSnapshot(commentsQuery, async querySnapshot => {
        const fetchedComments = await Promise.all(
          querySnapshot.docs.map(async docSnap => {
            const data = docSnap.data();
            // Fetch replies for each comment
            const repliesQuery = query(
              collection(
                db,
                'posts',
                post.id,
                'comments',
                docSnap.id,
                'replies',
              ),
            );
            const repliesSnapshot = await getDocs(repliesQuery);
            const replies = repliesSnapshot.docs.map(replyDoc => ({
              id: replyDoc.id,
              ...replyDoc.data(),
            }));
            return {
              id: docSnap.id,
              ...data,
              replies: replies,
            };
          }),
        );
        setComments(fetchedComments);

        // Update post data with new comment count
        const totalComments = fetchedComments.reduce((acc, comment) => {
          return acc + 1 + (comment.replies?.length || 0);
        }, 0);

        setPostData((prevData: any) => ({
          ...prevData,
          comments: totalComments,
        }));

        setLoadingComments(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching comments:', error);
      setLoadingComments(false);
    }
  };

  const checkIfUserLiked = () => {
    const currentUserEmail = auth.currentUser?.email;
    if (currentUserEmail && postData.likedBy) {
      setIsLiked(postData.likedBy.includes(currentUserEmail));
    }
  };

  // Handle like/dislike
  const handleLike = async () => {
    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) {
      Alert.alert('Error', 'You must be logged in to like posts');
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      const likedBy = postData.likedBy || [];
      const alreadyLiked = likedBy.includes(currentUserEmail);

      if (alreadyLiked) {
        // Unlike
        await updateDoc(postRef, {
          likes: Math.max(0, (postData.likes || 1) - 1),
          likedBy: arrayRemove(currentUserEmail),
        });
        setIsLiked(false);
      } else {
        // Like
        await updateDoc(postRef, {
          likes: (postData.likes || 0) + 1,
          likedBy: arrayUnion(currentUserEmail),
        });
        setIsLiked(true);
      }
      // Update local state
      setPostData({
        ...postData,
        likes: alreadyLiked
          ? Math.max(0, (postData.likes || 1) - 1)
          : (postData.likes || 0) + 1,
      });
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Add comment to Firebase
  const addComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Validation', 'Please write a comment');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to comment');
      return;
    }

    try {
      // Fetch current user's data using UID (same as settings)
      const uid = currentUser.uid;
      const userDoc = await getDoc(doc(db, 'user_data', uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      // Get exact first and last names
      const userName = `${userData.firstName || 'User'} ${
        userData.lastName || ''
      }`.trim();

      const newCommentObj = {
        text: newComment,
        userName: userName,
        userEmail: currentUser.email,
        userProfileImage: userData?.profileImage || d_assets.images.appLogo,
        timestamp: serverTimestamp(),
        likedBy: [],
      };

      await addDoc(collection(db, 'posts', post.id, 'comments'), newCommentObj);

      // Update comment count asynchronously - count will update via onSnapshot
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  // Add reply to comment
  const addReply = async (commentId: string) => {
    if (!newComment.trim()) {
      Alert.alert('Validation', 'Please write a reply');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to reply');
      return;
    }

    try {
      // Fetch current user's data using UID (same as settings)
      const uid = currentUser.uid;
      const userDoc = await getDoc(doc(db, 'user_data', uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      // Get exact first and last names
      const userName = `${userData.firstName || 'User'} ${
        userData.lastName || ''
      }`.trim();

      const newReplyObj = {
        text: newComment,
        userName: userName,
        userEmail: currentUser.email,
        userProfileImage: userData?.profileImage || d_assets.images.appLogo,
        timestamp: serverTimestamp(),
        likedBy: [],
      };

      await addDoc(
        collection(db, 'posts', post.id, 'comments', commentId, 'replies'),
        newReplyObj,
      );

      // Reply count updates automatically via fetchComments onSnapshot
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Failed to add reply');
    }
  };

  // Open comment menu
  const openCommentMenu = (comment: any) => {
    setSelectedComment(comment);
    setEditingText(comment.text);
    setShowCommentMenuModal(true);
  };

  // Edit comment
  const handleEditComment = async () => {
    if (!editingText.trim()) {
      Alert.alert('Validation', 'Comment cannot be empty');
      return;
    }

    try {
      const commentRef = doc(
        db,
        'posts',
        post.id,
        'comments',
        selectedComment.id,
      );
      await updateDoc(commentRef, {
        text: editingText,
      });
      setShowCommentMenuModal(false);
      setIsEditMode(false);
      setSelectedComment(null);
      Alert.alert('Success', 'Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  // Delete comment
  const handleDeleteComment = async () => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, 'posts', post.id, 'comments', selectedComment.id),
              );
              // Update comment count
              await updateDoc(doc(db, 'posts', post.id), {
                comments: Math.max(0, (postData.comments || 1) - 1),
              });
              setShowCommentMenuModal(false);
              setSelectedComment(null);
              Alert.alert('Success', 'Comment deleted successfully');
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ],
    );
  };

  // Delete reply
  const handleDeleteReply = async (commentId: string, replyId: string) => {
    Alert.alert('Delete Reply', 'Are you sure you want to delete this reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(
              doc(
                db,
                'posts',
                post.id,
                'comments',
                commentId,
                'replies',
                replyId,
              ),
            );
            setShowCommentMenuModal(false);
            setSelectedComment(null);
            Alert.alert('Success', 'Reply deleted successfully');
          } catch (error) {
            console.error('Error deleting reply:', error);
            Alert.alert('Error', 'Failed to delete reply');
          }
        },
      },
    ]);
  };

  const toggleReplies = (commentId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  /* ============= MEDIA RENDERING ============= */
  const renderMedia = () => {
    // Handle single image (string)
    if (typeof postData.image === 'string' && postData.image) {
      return (
        <TouchableOpacity onPress={() => setImageModalVisible(true)}>
          <Image source={{ uri: postData.image }} style={styles.media} />
        </TouchableOpacity>
      );
    }

    // Handle array of images
    if (Array.isArray(postData.image) && postData.image.length > 0) {
      if (postData.image.length === 1) {
        return (
          <TouchableOpacity onPress={() => setImageModalVisible(true)}>
            <Image source={postData.image[0]} style={styles.media} />
          </TouchableOpacity>
        );
      }

      return (
        <ScrollView horizontal pagingEnabled>
          {postData.image.map((img: any, index: number) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setCurrentImageIndex(index);
                setImageModalVisible(true);
              }}
            >
              <Image source={img} style={styles.media} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    return null;
  };

  // Prepare images for zoom viewer
  const getImagesForZoom = () => {
    if (typeof postData.image === 'string' && postData.image) {
      return [{ url: postData.image }];
    }
    if (Array.isArray(postData.image)) {
      return postData.image.map((img: any) => ({
        url: img.uri || img,
      }));
    }
    return [];
  };

  const renderComment = (
    comment: any,
    isReply = false,
    isLastReply = false,
    parentCommentId?: string,
  ) => {
    const currentUserEmail = auth.currentUser?.email;
    const isCommentOwner = comment.userEmail === currentUserEmail;

    // Handler for opening menu for replies
    const handleReplyMenuPress = () => {
      if (isReply && parentCommentId) {
        // For replies, show delete only option
        Alert.alert(
          'Delete Reply',
          'Are you sure you want to delete this reply?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => handleDeleteReply(parentCommentId, comment.id),
            },
          ],
        );
      } else {
        // For comments, open the full menu
        openCommentMenu(comment);
      }
    };

    return (
      <View
        key={comment.id}
        style={[styles.commentContainer, isReply && styles.replyContainer]}
      >
        {isReply && (
          <View
            style={[
              styles.replyConnector,
              isLastReply && styles.lastReplyConnector,
            ]}
          />
        )}
        <Image
          source={
            typeof comment.userProfileImage === 'string'
              ? { uri: comment.userProfileImage }
              : comment.userProfileImage || d_assets.images.appLogo
          }
          style={styles.commentAvatar}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.commentHeaderRow}>
            <Text style={styles.commentUser}>{comment.userName}</Text>
            {isCommentOwner && (
              <TouchableOpacity
                onPress={handleReplyMenuPress}
                style={styles.menuIcon}
              >
                <Icon name="ellipsis-horizontal" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <Text style={styles.commentTimestamp}>
              {getTimeAgo(comment.timestamp)}
            </Text>
            {!isReply && (
              <TouchableOpacity onPress={() => setReplyingTo(comment.id)}>
                <Text style={styles.replyText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  /* ============= UI ============= */
  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={25} color="#000" />
        </TouchableOpacity>
        <View style={styles.profileRow}>
          <Image
            source={
              typeof postData.user?.profileImage === 'string'
                ? { uri: postData.user.profileImage }
                : postData.user?.profileImage || d_assets.images.appLogo
            }
            style={styles.avatar}
          />
          <View>
            <Text style={styles.username}>
              {postData.author || postData.posterName || 'Unknown'}
            </Text>
            <Text style={styles.subInfo}>
              {postData.createdAt?.toDate?.().toLocaleDateString() ||
                'recently'}{' '}
              · 🌍
            </Text>
          </View>
        </View>
      </View>

      {/* POST CARD */}
      <View style={styles.facebookCard}>
        {/* TEXT */}
        <View style={styles.textContainer}>
          <Text
            style={styles.postText}
            numberOfLines={showFullText ? undefined : 8}
          >
            {postData.text || postData.content || postData.title}
          </Text>
          {(postData.text || postData.content || postData.title)?.length >
            250 && (
            <TouchableOpacity onPress={() => setShowFullText(!showFullText)}>
              <Text style={styles.readMoreText}>
                {showFullText ? 'See less' : 'See more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* IMAGE */}
        {renderMedia()}

        {/* COUNTERS */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>👍 {postData.likes || 0}</Text>
          <Text style={styles.counterText}>
            {postData.comments || 0} comments · {postData.shares || 0} shares
          </Text>
        </View>

        <View style={styles.divider} />

        {/* ACTIONS */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Icon
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? '#e74c3c' : '#65676B'}
            />
            <Text style={[styles.actionText, isLiked && { color: '#e74c3c' }]}>
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setCommentModalVisible(true)}
          >
            <Icon name="chatbubble-outline" size={20} color="#65676B" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Icon name="share-social-outline" size={20} color="#65676B" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* IMAGE ZOOM */}
      <Modal
        isVisible={isImageModalVisible}
        onBackdropPress={() => setImageModalVisible(false)}
        style={{ margin: 0, backgroundColor: '#000' }}
      >
        <ImageViewer
          imageUrls={getImagesForZoom()}
          index={currentImageIndex}
          enableSwipeDown
          onCancel={() => setImageModalVisible(false)}
          backgroundColor="#000"
        />
      </Modal>

      {/* COMMENTS MODAL */}
      <Modal
        isVisible={isCommentModalVisible}
        onBackdropPress={() => setCommentModalVisible(false)}
        style={{ justifyContent: 'flex-end', margin: 0 }}
      >
        <View style={styles.commentModal}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>
              Comments (
              {comments.length +
                comments.reduce((acc, c) => acc + (c.replies?.length || 0), 0)}
              )
            </Text>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
              <Icon name="close" size={22} />
            </TouchableOpacity>
          </View>

          <View style={styles.commentContent}>
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.light.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyCommentsContainer}>
                <Text style={styles.emptyCommentsText}>
                  No comments yet. Be the first to comment!
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.commentList}>
                {comments.map(comment => (
                  <View key={comment.id}>
                    <View style={styles.commentWrapper}>
                      {renderComment(comment)}
                      {comment.replies && comment.replies.length > 0 && (
                        <View style={styles.mainCommentConnector} />
                      )}
                    </View>
                    {expandedComments.has(comment.id) ? (
                      <>
                        {comment.replies?.map((reply: any, index: number) =>
                          renderComment(
                            reply,
                            true,
                            index === (comment.replies?.length || 0) - 1,
                            comment.id,
                          ),
                        )}
                        <TouchableOpacity
                          style={styles.hideRepliesBtn}
                          onPress={() => toggleReplies(comment.id)}
                        >
                          <Text style={styles.hideRepliesText}>
                            Hide replies
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      comment.replies &&
                      comment.replies.length > 0 && (
                        <TouchableOpacity
                          style={styles.viewRepliesBtn}
                          onPress={() => toggleReplies(comment.id)}
                        >
                          <Text style={styles.viewRepliesText}>
                            View {comment.replies.length}{' '}
                            {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.commentInputContainer}>
              <TextInput
                placeholder={
                  replyingTo ? 'Write a reply...' : 'Write a comment...'
                }
                style={styles.commentInput}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
                numberOfLines={4}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => {
                  if (replyingTo) {
                    addReply(replyingTo);
                  } else {
                    addComment();
                  }
                }}
              >
                <Icon name="send" color="#fff" size={18} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* COMMENT EDIT/DELETE MODAL */}
      <Modal
        isVisible={showCommentMenuModal}
        onBackdropPress={() => {
          setShowCommentMenuModal(false);
          setIsEditMode(false);
        }}
        style={{ justifyContent: 'flex-end', margin: 0 }}
      >
        <View style={styles.menuModalContent}>
          {!isEditMode ? (
            <>
              <View style={styles.menuModalHeader}>
                <Text style={styles.menuModalTitle}>Comment Options</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCommentMenuModal(false);
                    setIsEditMode(false);
                  }}
                >
                  <Icon name="close" size={22} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => setIsEditMode(true)}
              >
                <Icon name="pencil-outline" size={20} color="#007AFF" />
                <Text style={styles.menuOptionText}>Edit Comment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleDeleteComment}
              >
                <Icon name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>
                  Delete Comment
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowCommentMenuModal(false);
                  setIsEditMode(false);
                }}
              >
                <Text style={[styles.menuOptionText, { color: '#999' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.menuModalHeader}>
                <Text style={styles.menuModalTitle}>Edit Comment</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditMode(false);
                    setEditingText(selectedComment?.text || '');
                  }}
                >
                  <Icon name="close" size={22} />
                </TouchableOpacity>
              </View>

              <View style={styles.editInputContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editingText}
                  onChangeText={setEditingText}
                  multiline
                  placeholder="Edit your comment..."
                />
              </View>

              <View style={styles.editButtonsContainer}>
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => {
                    setIsEditMode(false);
                    setEditingText(selectedComment?.text || '');
                  }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveEditBtn}
                  onPress={handleEditComment}
                >
                  <Text style={styles.saveEditText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    height: '100%',
  },

  facebookCard: {
    backgroundColor: '#fafeffff',
    // marginBottom: 12,
    paddingTop: 12,
    flex: 1,
    // height: '100%',
    // alignItems: 'space-between',
    justifyContent: 'space-between',
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
    flex: 1,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    objectFit: 'scale-down',
    borderColor: COLORS.light.primary,
    borderWidth: 1,
    padding: 20,
  },

  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
  },

  subInfo: {
    fontSize: 12,
    color: '#65676B',
  },

  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#050505',
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  media: {
    width: '100%',
    height: 380,
    marginVertical: 8,
  },

  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  counterText: {
    fontSize: 13,
    color: '#65676B',
  },

  divider: {
    height: 1,
    backgroundColor: '#E4E6EB',
    marginHorizontal: 16,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#65676B',
  },

  /* COMMENTS */
  commentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '100%',
    minHeight: '60%',
    flex: 1,
    flexDirection: 'column',
  },

  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },

  commentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  commentInputContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
  },

  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },

  sendBtn: {
    backgroundColor: COLORS.light.primary,
    borderRadius: 20,
    padding: 12,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },

  textContainer: {
    paddingHorizontal: 5,
    marginBottom: 10,
  },

  readMoreText: {
    fontSize: 14,
    color: COLORS.light.primary,
    fontWeight: 'bold',
    marginTop: 4,
  },

  commentList: {
    flex: 1,
    paddingHorizontal: 16,
  },

  commentContainer: {
    flexDirection: 'row',
    marginVertical: 2,
  },

  replyContainer: {
    marginLeft: 40,
  },

  replyConnector: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 2,
    height: 15,
    backgroundColor: '#ddd',
  },

  lastReplyConnector: {
    height: 10,
  },

  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 20,
    marginRight: 12,
    objectFit: 'scale-down',
    borderColor: COLORS.light.primary,
    borderWidth: 1,
    padding: 20,
  },

  commentContent: {
    flex: 1,
    backgroundColor: '#fff',
  },

  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  commentUser: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },

  menuIcon: {
    padding: 5,
  },

  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },

  commentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  commentTimestamp: {
    fontSize: 12,
    color: '#666',
  },

  replyText: {
    fontSize: 12,
    color: COLORS.light.primary,
    fontWeight: 'bold',
  },

  commentWrapper: {
    position: 'relative',
  },

  mainCommentConnector: {
    position: 'absolute',
    left: 20,
    top: 40,
    width: 2,
    height: 20,
    backgroundColor: '#ddd',
  },

  viewRepliesBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 44,
  },

  viewRepliesText: {
    fontSize: 12,
    color: COLORS.light.primary,
    fontWeight: 'bold',
  },

  hideRepliesBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 44,
  },

  hideRepliesText: {
    fontSize: 12,
    color: COLORS.light.primary,
    fontWeight: 'bold',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyCommentsText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },

  /* EDIT/DELETE MODAL */
  menuModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },

  menuModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },

  menuModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  menuOptionText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#050505',
  },

  editInputContainer: {
    padding: 16,
  },

  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
  },

  editButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },

  cancelEditBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },

  cancelEditText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },

  saveEditBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.light.primary,
    borderRadius: 8,
    alignItems: 'center',
  },

  saveEditText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

// Helper function to format time ago
const getTimeAgo = (timestamp: any): string => {
  if (!timestamp) return 'now';

  const now = new Date();
  const commentDate = timestamp.toDate?.() || new Date(timestamp);
  const diffMs = now.getTime() - commentDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 52) return `${diffWeeks}w ago`;
  return `${diffYears}y ago`;
};

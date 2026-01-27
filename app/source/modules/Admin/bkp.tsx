import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Image,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../auth/firebaseConfig';
import { COLORS } from '../../../core/theme/colors';
import { RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function AdminPosts({ navigation }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [editingPost, setEditingPost] = useState<any>(null);
  const richText = useRef<RichEditor>(null);
  const [richEditorContent, setRichEditorContent] = useState('');

  const [newPost, setNewPost] = useState({
    category: 'news',
    title: '',
    content: '',
    summary: '',
    fullText: '',
    decisionTitle: '',
    decisionSummary: '',
    decisionDetails: '',
    eventName: '',
    eventLocation: '',
    description: '',
    image: '',
  });

  useEffect(() => {
    fetchPosts();
    fetchAdminName();
  }, []);

  const fetchPosts = async () => {
    const snap = await getDocs(collection(db, 'posts'));
    setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
   
  };

  const fetchAdminName = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    const docSnap = await getDoc(doc(db, 'user_data', email));
    if (docSnap.exists()) {
      const d = docSnap.data();
      setAdminName(`${d.firstName} ${d.lastName}`);
    }
  };

  const resetForm = () => {
    setNewPost({
      category: 'news',
      title: '',
      content: '',
      summary: '',
      fullText: '',
      decisionTitle: '',
      decisionSummary: '',
      decisionDetails: '',
      eventName: '',
      eventLocation: '',
      description: '',
      image: '',
    });
    setRichEditorContent('');
  };

  const handleCreatePost = async () => {
    try {
      // Title validation rule
      const requiresTitle =
        newPost.category !== 'decisions' &&
        newPost.category !== 'reforms' &&
        newPost.category !== 'events';

      if (requiresTitle && !newPost.title?.trim()) {
        Alert.alert('Validation', 'Title is required');
        return;
      }

      // Use HTML content for reforms & decisions
      const content =
        newPost.category === 'decisions' || newPost.category === 'reforms'
          ? richEditorContent
          : newPost.content;

      const postData = {
        ...newPost,
        title: newPost.title?.trim() || null, // allow null for reforms/decisions
        content,
        author: adminName || 'Admin',
        posterName: adminName || 'Admin',
        likes: 0,
        comments: 0,
        shares: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postData);

      resetForm();
      setShowCreateForm(false);
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    }
  };

  const handleDeletePost = async (id: string) => {
    Alert.alert('Delete', 'Delete this post?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'posts', id));
          fetchPosts();
        },
      },
    ]);
  };

  const handleEditPost = (post: any) => {
    setEditingPost(post);
    setNewPost({
      category: post.category || 'news',
      title: post.title || '',
      content: post.content || '',
      summary: post.summary || '',
      fullText: post.fullText || '',
      decisionTitle: post.decisionTitle || '',
      decisionSummary: post.decisionSummary || '',
      decisionDetails: post.decisionDetails || '',
      eventName: post.eventName || '',
      eventLocation: post.eventLocation || '',
      description: post.description || '',
      image: post.image || '',
    });
    if (post.category === 'decisions' || post.category === 'reforms') {
      setRichEditorContent(post.content || '');
    }
    setShowEditForm(true);
  };

  const handleUpdatePost = async () => {
    const requiresTitle =
      newPost.category !== 'decisions' &&
      newPost.category !== 'reforms' &&
      newPost.category !== 'events';

    if (requiresTitle && (!editingPost || !newPost.title?.trim())) {
      Alert.alert('Validation', 'Title is required');
      return;
    }

    // Use HTML content for reforms & decisions
    const content =
      newPost.category === 'decisions' || newPost.category === 'reforms'
        ? richEditorContent
        : newPost.content;

    await updateDoc(doc(db, 'posts', editingPost.id), {
      ...newPost,
      content,
      updatedAt: serverTimestamp(),
    });

    resetForm();
    setShowEditForm(false);
    setEditingPost(null);
    fetchPosts();
  };

  const renderPost = ({ item }: any) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View>
          <Text style={styles.postCategory}>{item.category.toUpperCase()}</Text>
          <Text style={styles.postAuthor}>
            {item.posterName || item.author || 'Admin'}
          </Text>
        </View>
        <Text style={styles.postDate}>
          {item.createdAt?.toDate?.().toLocaleDateString() || ''}
        </Text>
      </View>

      <Text style={styles.postTitle}>{item.title}</Text>
      <Text style={styles.postExcerpt} numberOfLines={2}>
        {item.content || item.summary || item.description}
      </Text>

      <View style={styles.engagementRow}>
        <View style={styles.engagementItem}>
          <Icon name="heart-outline" size={16} color="#666" />
          <Text style={styles.engagementText}>{item.likes || 0} likes</Text>
        </View>
        <View style={styles.engagementItem}>
          <Icon name="chatbubble-outline" size={16} color="#666" />
          <Text style={styles.engagementText}>
            {item.comments || 0} comments
          </Text>
        </View>
        <View style={styles.engagementItem}>
          <Icon name="share-social-outline" size={16} color="#666" />
          <Text style={styles.engagementText}>{item.shares || 0} shares</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => handleEditPost(item)}
        >
          <Icon name="create" size={16} color="#fff" />
          <Text style={styles.btnText}> Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeletePost(item.id)}
        >
          <Icon name="trash" size={16} color="#fff" />
          <Text style={styles.btnText}> Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={22} color="#333" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Manage Posts</Text>

      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowCreateForm(!showCreateForm)}
      >
        <Text style={styles.createText}>Create New Post</Text>
      </TouchableOpacity>

      {showCreateForm && (
        <Modal
          visible
          animationType="slide"
          style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}
          presentationStyle="overFullScreen"
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowCreateForm(false)}
          >
            <Ionicons name="close" size={20} color="#666" />
            <Text style={styles.menuText}>Cancel</Text>
          </TouchableOpacity>
          <ScrollView>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.form}>
                {/* CATEGORY */}
                <TouchableOpacity
                  style={styles.inputWithIcon}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Icon name="list" size={20} color="#666" />
                  <Text style={styles.categoryText}>
                    {newPost.category.toUpperCase()}
                  </Text>
                </TouchableOpacity>

                {/* NEWS */}
                {newPost.category === 'news' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="News title"
                      value={newPost.title}
                      onChangeText={t => setNewPost({ ...newPost, title: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="News content"
                      multiline
                      value={newPost.content}
                      onChangeText={t => setNewPost({ ...newPost, content: t })}
                    />
                  </>
                )}

                {/* ANNOUNCEMENTS */}
                {newPost.category === 'announcements' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Title"
                      value={newPost.title}
                      onChangeText={t => setNewPost({ ...newPost, title: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="Announcement"
                      multiline
                      value={newPost.content}
                      onChangeText={t => setNewPost({ ...newPost, content: t })}
                    />
                  </>
                )}

                {/* DECISIONS */}
                {newPost.category === 'decisions' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Decision title"
                      value={newPost.decisionTitle}
                      onChangeText={t =>
                        setNewPost({ ...newPost, decisionTitle: t })
                      }
                    />
                    <Text style={styles.label}>
                      Decision Content (HTML Editor)
                    </Text>
                    <RichToolbar
                      editor={richText}
                      actions={['bold', 'italic', 'image', 'link', 'fontSize']}
                      iconMap={{ insertImage: 'image' }}
                    />
                    <RichEditor
                      ref={richText}
                      onChange={setRichEditorContent}
                      placeholder="Enter decision content..."
                      initialContentHTML={richEditorContent}
                      style={styles.richEditor}
                    />
                  </>
                )}

                {/* REFORMS */}
                {newPost.category === 'reforms' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Reform title"
                      value={newPost.decisionTitle}
                      onChangeText={t =>
                        setNewPost({ ...newPost, decisionTitle: t })
                      }
                    />
                    <Text style={styles.label}>
                      Reform Content (HTML Editor)
                    </Text>
                    <RichToolbar
                      editor={richText}
                      actions={['bold', 'italic', 'image', 'link', 'fontSize']}
                      iconMap={{ insertImage: 'image' }}
                    />
                    <RichEditor
                      ref={richText}
                      onChange={setRichEditorContent}
                      placeholder="Enter reform content..."
                      initialContentHTML={richEditorContent}
                      style={styles.richEditor}
                    />
                  </>
                )}

                {/* EVENTS */}
                {newPost.category === 'events' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Event name"
                      value={newPost.eventName}
                      onChangeText={t =>
                        setNewPost({ ...newPost, eventName: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Location"
                      value={newPost.eventLocation}
                      onChangeText={t =>
                        setNewPost({ ...newPost, eventLocation: t })
                      }
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="Description"
                      multiline
                      value={newPost.description}
                      onChangeText={t =>
                        setNewPost({ ...newPost, description: t })
                      }
                    />
                  </>
                )}

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleCreatePost}
                >
                  <Text style={styles.submitText}>Publish</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </Modal>
      )}

      {showEditForm && (
        <Modal
          visible
          animationType="slide"
          style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}
          presentationStyle="overFullScreen"
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowEditForm(false)}
          >
            <Ionicons name="close" size={20} color="#666" />
            <Text style={styles.menuText}>Cancel</Text>
          </TouchableOpacity>
          <ScrollView>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.form}>
                <Text style={styles.editTitle}>Edit Post</Text>

                {/* CATEGORY */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Icon name="list" size={20} color="#666" />
                  <Text style={styles.categoryText}>
                    {newPost.category.toUpperCase()}
                  </Text>
                </TouchableOpacity>

                {/* NEWS */}
                {newPost.category === 'news' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="News title"
                      value={newPost.title}
                      onChangeText={t => setNewPost({ ...newPost, title: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="News content"
                      multiline
                      value={newPost.content}
                      onChangeText={t => setNewPost({ ...newPost, content: t })}
                    />
                  </>
                )}

                {/* ANNOUNCEMENTS */}
                {newPost.category === 'announcements' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Title"
                      value={newPost.title}
                      onChangeText={t => setNewPost({ ...newPost, title: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="Announcement"
                      multiline
                      value={newPost.content}
                      onChangeText={t => setNewPost({ ...newPost, content: t })}
                    />
                  </>
                )}

                {/* DECISIONS */}
                {newPost.category === 'decisions' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Decision title"
                      value={newPost.decisionTitle}
                      onChangeText={t =>
                        setNewPost({ ...newPost, decisionTitle: t })
                      }
                    />
                    <Text style={styles.label}>
                      Decision Content (HTML Editor)
                    </Text>
                    <RichToolbar
                      editor={richText}
                      actions={['bold', 'italic', 'insertImage', 'fontSize']}
                      iconMap={{ insertImage: 'image' }}
                    />
                    <RichEditor
                      ref={richText}
                      onChange={setRichEditorContent}
                      placeholder="Enter decision content..."
                      initialContentHTML={richEditorContent}
                      style={styles.richEditor}
                    />
                  </>
                )}

                {/* REFORMS */}
                {newPost.category === 'reforms' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Reform title"
                      value={newPost.decisionTitle}
                      onChangeText={t =>
                        setNewPost({ ...newPost, decisionTitle: t })
                      }
                    />
                    <Text style={styles.label}>
                      Reform Content (HTML Editor)
                    </Text>
                    <RichToolbar
                      editor={richText}
                      actions={['bold', 'italic', 'insertImage', 'fontSize']}
                      iconMap={{ insertImage: 'image' }}
                    />
                    <RichEditor
                      ref={richText}
                      onChange={setRichEditorContent}
                      placeholder="Enter reform content..."
                      initialContentHTML={richEditorContent}
                      style={styles.richEditor}
                    />
                  </>
                )}

                {/* EVENTS */}
                {newPost.category === 'events' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Event name"
                      value={newPost.eventName}
                      onChangeText={t =>
                        setNewPost({ ...newPost, eventName: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Image URL (optional)"
                      value={newPost.image}
                      onChangeText={t => setNewPost({ ...newPost, image: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Location"
                      value={newPost.eventLocation}
                      onChangeText={t =>
                        setNewPost({ ...newPost, eventLocation: t })
                      }
                    />
                    <TextInput
                      style={styles.textarea}
                      placeholder="Description"
                      multiline
                      value={newPost.description}
                      onChangeText={t =>
                        setNewPost({ ...newPost, description: t })
                      }
                    />
                  </>
                )}

                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowEditForm(false);
                      resetForm();
                      setEditingPost(null);
                    }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleUpdatePost}
                  >
                    <Text style={styles.submitText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </Modal>
      )}

      <FlatList
        data={posts}
        keyExtractor={i => i.id}
        renderItem={renderPost}
        scrollEnabled={false}
      />

      {/* CATEGORY MODAL */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {['news', 'announcements', 'decisions', 'reforms', 'events'].map(
              c => (
                <TouchableOpacity
                  key={c}
                  style={styles.modalItem}
                  onPress={() => {
                    setNewPost({ ...newPost, category: c });
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{c.toUpperCase()}</Text>
                </TouchableOpacity>
              ),
            )}
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { marginLeft: 8, color: COLORS.light.primary },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  createBtn: {
    backgroundColor: COLORS.light.primary,
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  createText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  menuText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  form: { marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    height: 100,
    marginBottom: 10,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  richEditor: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    height: 200,
    marginBottom: 10,
  },

  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 10,
  },
  categoryText: { marginLeft: 10, fontWeight: '600' },

  submitBtn: { backgroundColor: 'green', padding: 14, borderRadius: 8 },
  submitText: { color: '#fff', textAlign: 'center', fontWeight: '600' },

  postCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  postCategory: {
    fontSize: 12,
    color: COLORS.light.primary,
    fontWeight: 'bold',
  },
  postAuthor: { fontSize: 12, color: '#888', marginTop: 2 },
  postDate: { fontSize: 12, color: '#888' },
  postTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  postExcerpt: { color: '#555', marginBottom: 10 },

  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  engagementItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engagementText: { fontSize: 12, color: '#666', marginLeft: 4 },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },

  editBtn: {
    backgroundColor: '#007bff',
    padding: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  deleteBtn: { backgroundColor: '#dc3545', padding: 8, borderRadius: 6 },
  btnText: { color: '#fff' },

  editTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelBtn: {
    backgroundColor: '#6c757d',
    padding: 14,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelText: { color: '#fff', textAlign: 'center', fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContent: { backgroundColor: '#fff', margin: 40, borderRadius: 10 },
  modalItem: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  modalItemText: { textAlign: 'center', fontWeight: '600' },
  modalClose: { textAlign: 'center', padding: 16, color: 'red' },
});

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import Ionicons from 'react-native-vector-icons/Ionicons';

/* ================= MAIN ================= */
export default function AdminPosts({ navigation }: any) {
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'create' | 'edit' | 'manage' | null>(null);

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
    setLoading(false);
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
    setMode(null);
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
    setMode('edit');
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
  /* ================= CARD ================= */
  const renderPost = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      // onPress={() => handleEditPost(item)}
      activeOpacity={0.9}
    >
      <View style={styles.iconBox}>
        <Icon name="document-text-outline"color={COLORS.light.primary} size={35} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          {item.content || item.summary || item.description}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {item.posterName || item.author || 'Admin'} - {item.category}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => {
            handleEditPost(item);
          }}
        >
          <Icon name="pencil" size={18} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
          <Icon name="trash" size={18} color="red" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Posts</Text>
        <TouchableOpacity onPress={() => setMode('create')}>
          <Icon name="add" size={26} />
        </TouchableOpacity>
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={i => i.id}
          contentContainerStyle={{ gap: 12 }}
        />
      )}

      {/* MODAL */}
      <Modal visible={!!mode} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* CREATE / EDIT */}
              {showEditForm && (
                <>
                  <ScrollView>
                    <KeyboardAvoidingView behavior="padding">
                      <TouchableOpacity
                        style={styles.card1}
                        onPress={() => setShowCategoryPicker(true)}
                      >
                        <Icon name="list" size={20} color="#666" />
                        <Text style={styles.name}>
                          {newPost.category.toUpperCase()} - "click to select"
                        </Text>
                      </TouchableOpacity>

                      {/* NEWS */}
                      {newPost.category === 'news' && (
                        <>
                          <Input
                            placeholder="News title"
                            value={newPost.title}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, title: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="News content"
                            value={newPost.content}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, content: t })
                            }
                          />
                        </>
                      )}

                      {/* NEWS */}
                      {newPost.category === 'announcements' && (
                        <>
                          <Input
                            placeholder="Title"
                            value={newPost.title}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, title: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="Announcement content"
                            value={newPost.content}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, content: t })
                            }
                          />
                        </>
                      )}

                      {/* DECISIONS */}
                      {newPost.category === 'decisions' && (
                        <>
                          <Input
                            placeholder="Decision title"
                            value={newPost.decisionTitle}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, decisionTitle: t })
                            }
                          />
                          <Text style={styles.name}>
                            Decision Content (HTML Editor)
                          </Text>
                          <RichToolbar
                            editor={richText}
                            actions={[
                              'bold',
                              'italic',
                              'insertImage',
                              'fontSize',
                            ]}
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
                          <Input
                            placeholder="Reforms title"
                            value={newPost.decisionTitle}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, decisionTitle: t })
                            }
                          />
                          <Text style={styles.name}>
                            Reforms Content (HTML Editor)
                          </Text>
                          <RichToolbar
                            editor={richText}
                            actions={[
                              'bold',
                              'italic',
                              'insertImage',
                              'fontSize',
                            ]}
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

                      {/* EVENTS */}
                      {newPost.category === 'events' && (
                        <>
                          <Input
                            placeholder="Event name"
                            value={newPost.eventName}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, eventName: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="Event location"
                            value={newPost.eventLocation}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, eventLocation: t })
                            }
                          />
                          <Input
                            placeholder="Description"
                            value={newPost.description}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, description: t })
                            }
                          />
                        </>
                      )}

                      <PrimaryButton
                        label="Update Post"
                        onPress={handleUpdatePost}
                      />
                    </KeyboardAvoidingView>

                    <TouchableOpacity style={styles.close} onPress={resetForm}>
                      <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}

              {/* MANAGE */}
              {showCreateForm && (
                <>
                  <ScrollView>
                    <KeyboardAvoidingView behavior="padding">
                      <TouchableOpacity
                        style={styles.card1}
                        onPress={() => setShowCategoryPicker(true)}
                      >
                        <Icon name="list" size={20} color="#666" />
                        <Text style={styles.name}>
                          {newPost.category.toUpperCase()} - "click to select"
                        </Text>
                      </TouchableOpacity>

                      {/* NEWS */}
                      {newPost.category === 'news' && (
                        <>
                          <Input
                            placeholder="News title"
                            // value={newPost.title}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, title: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            // value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="News content"
                            // value={newPost.content}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, content: t })
                            }
                          />
                        </>
                      )}

                      {/* NEWS */}
                      {newPost.category === 'announcements' && (
                        <>
                          <Input
                            placeholder="Title"
                            // value={newPost.title}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, title: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            // value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="Announcement content"
                            // value={newPost.content}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, content: t })
                            }
                          />
                        </>
                      )}

                      {/* DECISIONS */}
                      {newPost.category === 'decisions' && (
                        <>
                          <Input
                            placeholder="Decision title"
                            // value={newPost.decisionTitle}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, decisionTitle: t })
                            }
                          />
                          <Text style={styles.name}>
                            Decision Content (HTML Editor)
                          </Text>
                          <RichToolbar
                            editor={richText}
                            actions={[
                              'bold',
                              'italic',
                              'image',
                              'fontSize',
                            ]}
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
                          <Input
                            placeholder="Reforms title"
                            // value={newPost.decisionTitle}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, decisionTitle: t })
                            }
                          />
                          <Text style={styles.name}>
                            Reforms Content (HTML Editor)
                          </Text>
                          <RichToolbar
                            editor={richText}
                            actions={[
                              'bold',
                              'italic',
                              'image',
                              'link',
                              'fontSize',
                            ]}
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

                      {/* EVENTS */}
                      {newPost.category === 'events' && (
                        <>
                          <Input
                            placeholder="Event name"
                            // value={newPost.eventName}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, eventName: t })
                            }
                          />
                          <Input
                            placeholder="Image URL (optional)"
                            // value={newPost.image}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, image: t })
                            }
                          />
                          <Input
                            placeholder="Event location"
                            // value={newPost.eventLocation}
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, eventLocation: t })
                            }
                          />
                          <Input
                            placeholder="Description"
                            value={newPost.description}
                            style={styles.textarea}
                            multiline
                            onChangeText={(t: any) =>
                              setNewPost({ ...newPost, description: t })
                            }
                          />
                        </>
                      )}

                      <PrimaryButton
                        label="Publish"
                        onPress={handleCreatePost}
                      />
                    </KeyboardAvoidingView>

                    <TouchableOpacity style={styles.close} onPress={resetForm}>
                      <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    </View>
  );
}

/* ================= UI PARTS ================= */
const Input = (props: any) => <TextInput {...props} style={styles.input} />;

const PrimaryButton = ({ label, onPress }: any) => (
  <TouchableOpacity style={styles.primaryBtn} onPress={onPress}>
    <Text style={styles.primaryText}>{label}</Text>
  </TouchableOpacity>
);

const Section = ({ title }: any) => <Text style={styles.section}>{title}</Text>;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
   modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContent: { backgroundColor: '#fff', margin: 40, borderRadius: 10 },
  modalItem: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  modalItemText: { textAlign: 'center', fontWeight: '600' },
  modalClose: { textAlign: 'center', padding: 16, color: 'red' },

  title: { fontSize: 20, fontWeight: '600' },
  richEditor: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    height: 200,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 52,
    height: 62,
    borderRadius: 18,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 12, color: '#777' },
  actions: { flexDirection: 'row', gap: 14 },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    height: 100,
    marginBottom: 10,
  },
  card1: {
    flex: 1,
    borderColor: '#ddd',
    borderWidth: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },

  input: {
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600' },

  section: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },

  item: {
    paddingVertical: 6,
    fontSize: 13,
    color: '#555',
  },

  close: { alignItems: 'center', marginTop: 16 },
  closeText: { fontSize: 16, color: COLORS.light.primary },
});

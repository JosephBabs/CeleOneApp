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
  Platform,
  Pressable,
  Image,
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
import { launchImageLibrary } from 'react-native-image-picker';
import Auth from '@react-native-firebase/auth';
/**
 * ✅ Change this to your real upload endpoint
 * Your server should store under /uploads/posts/ and return { url }
 */
const CDN_UPLOAD_ENDPOINT = 'https://cdn.celeonetv.com/api/uploads/posts';

type UploadAsset = {
  uri: string;
  type?: string;
  fileName?: string;
};

export default function AdminPosts({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [adminName, setAdminName] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const richText = useRef<RichEditor>(null);
  const [richEditorContent, setRichEditorContent] = useState('');

  const [newPost, setNewPost] = useState({
    category: 'news',
    title: '',
    image: '',
  });

  // upload states
  const [localImage, setLocalImage] = useState<UploadAsset | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  /* ================= INIT ================= */

  useEffect(() => {
    fetchPosts();
    fetchAdminName();
  }, []);

  const fetchPosts = async () => {
    try {
      const snap = await getDocs(collection(db, 'posts'));
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminName = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;

    const snap = await getDoc(doc(db, 'user_data', email));
    if (snap.exists()) {
      const d = snap.data();
      setAdminName(`${d.firstName} ${d.lastName}`);
    }
  };

  /* ================= RESET ================= */

  const resetForm = () => {
    setEditingPost(null);
    setNewPost({
      category: 'news',
      title: '',
      image: '',
    });
    setRichEditorContent('');
    setLocalImage(null);
    setUploadingImage(false);

    setModalVisible(false);
    setShowCategoryPicker(false);
  };

  /* ================= IMAGE PICK + UPLOAD ================= */

  const pickImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.85,
    });

    if (res.didCancel) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    setLocalImage({
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      fileName: asset.fileName || `post_${Date.now()}.jpg`,
    });
  };

  /**
   * Uploads selected image to your CDN endpoint
   * Expects JSON response: { url: "https://cdn.celeonetv.com/uploads/posts/xxx.jpg" }
   */
  const uploadImageToCDN = async (asset: UploadAsset): Promise<string> => {
    
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `post_${Date.now()}.jpg`,
    } as any);

    const resp = await fetch(CDN_UPLOAD_ENDPOINT, {
      method: 'POST',
      // do NOT set Content-Type manually for multipart in RN
      
      body: form,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Upload failed (${resp.status}): ${txt}`);
    }

    const json = await resp.json();
    if (!json?.url) throw new Error('Upload response missing url');
    return json.url as string;
  };

  const handleUploadPressed = async () => {
    if (!localImage) {
      Alert.alert('Select Image', 'Please choose an image first.');
      return;
    }

    try {
      setUploadingImage(true);
      const url = await uploadImageToCDN(localImage);
      setNewPost(p => ({ ...p, image: url }));
      Alert.alert('Uploaded', 'Image uploaded successfully.');
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  /* ================= CREATE ================= */

  const handleCreatePost = async () => {
    if (!newPost.title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }

    try {
      // If user picked image but forgot to upload, you can auto-upload here:
      if (localImage && !newPost.image) {
        setUploadingImage(true);
        const url = await uploadImageToCDN(localImage);
        newPost.image = url; // safe because we immediately write it
      }

      await addDoc(collection(db, 'posts'), {
        ...newPost,
        content: richEditorContent,
        author: adminName || 'Admin',
        posterName: adminName || 'Admin',
        likes: 0,
        comments: 0,
        shares: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });

      resetForm();
      fetchPosts();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create post');
    } finally {
      setUploadingImage(false);
    }
  };

  /* ================= UPDATE ================= */

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    if (!newPost.title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }

    try {
      // Auto-upload if picked but not uploaded
      if (localImage && !newPost.image) {
        setUploadingImage(true);
        const url = await uploadImageToCDN(localImage);
        newPost.image = url;
      }

      await updateDoc(doc(db, 'posts', editingPost.id), {
        ...newPost,
        content: richEditorContent,
        updatedAt: serverTimestamp(),
      });

      resetForm();
      fetchPosts();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update post');
    } finally {
      setUploadingImage(false);
    }
  };

  /* ================= DELETE ================= */

  const handleDeletePost = (id: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
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

  /* ================= EDIT OPEN ================= */

  const openEdit = (post: any) => {
    setEditingPost(post);
    setNewPost({
      category: post.category || 'news',
      title: post.title || '',
      image: post.image || '',
    });
    setRichEditorContent(post.content || '');
    setLocalImage(null);
    setModalVisible(true);
  };

  /* ================= RENDER CARD ================= */

  const renderPost = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.category?.toUpperCase()}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Icon name="image-outline" size={18} color="#777" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.postMeta} numberOfLines={1}>
            {item.posterName || 'Admin'}
          </Text>

          <View style={styles.statsRow}>
            <Text style={styles.stat}>❤️ {item.likes || 0}</Text>
            <Text style={styles.stat}>💬 {item.comments || 0}</Text>
            <Text style={styles.stat}>🔁 {item.shares || 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Icon name="create-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeletePost(item.id)}
        >
          <Icon name="trash-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ================= UI ================= */

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Posts Management</Text>
            <Text style={styles.heroSub}>{posts.length} posts total</Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingPost(null);
              setModalVisible(true);
            }}
          >
            <Icon name="add" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ===== MODAL ===== */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={resetForm} />

        <View style={styles.sheetWrap}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View style={styles.handle} />
                <View style={styles.sheetTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>
                      {editingPost ? 'Edit Post' : 'Create Post'}
                    </Text>
                    <Text style={styles.sheetSub}>
                      Use link or upload to CDN
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.closeIcon}
                    onPress={resetForm}
                  >
                    <Icon name="close" size={20} color="#111" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Category */}
                <Text style={styles.label}>Category</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowCategoryPicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.pickerLeft}>
                    <Icon name="pricetag-outline" size={18} color="#666" />
                    <Text style={styles.pickerText}>
                      {newPost.category.toUpperCase()}
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={18} color="#666" />
                </TouchableOpacity>

                {/* Title */}
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  placeholder="Enter post title"
                  placeholderTextColor="#9AA0A6"
                  value={newPost.title}
                  onChangeText={t => setNewPost({ ...newPost, title: t })}
                  style={styles.input}
                />

                {/* Image Link */}
                <Text style={styles.label}>Image URL (optional)</Text>
                <TextInput
                  placeholder="https://..."
                  placeholderTextColor="#9AA0A6"
                  value={newPost.image}
                  onChangeText={t => setNewPost({ ...newPost, image: t })}
                  style={styles.input}
                />

                {/* OR Upload */}
                <View style={styles.uploadBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadTitle}>Or upload image</Text>
                    <Text style={styles.uploadSub}>
                      Upload to: cdn.celeonetv.com/uploads/posts/
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
                    <Icon name="images-outline" size={18} color="#111" />
                    <Text style={styles.pickText}>Pick</Text>
                  </TouchableOpacity>
                </View>

                {/* Preview */}
                {localImage?.uri || newPost.image ? (
                  <View style={styles.previewWrap}>
                    <Image
                      source={{ uri: newPost.image || localImage?.uri }}
                      style={styles.preview}
                    />
                    <View style={styles.previewRow}>
                      <TouchableOpacity
                        style={[
                          styles.uploadBtn,
                          uploadingImage && { opacity: 0.6 },
                        ]}
                        onPress={handleUploadPressed}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Icon
                              name="cloud-upload-outline"
                              size={16}
                              color="#fff"
                            />
                            <Text style={styles.uploadBtnText}>
                              Upload to CDN
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => {
                          setLocalImage(null);
                          // keep link if user pasted; if you want also clear link:
                          // setNewPost(p => ({...p, image: ""}));
                        }}
                      >
                        <Icon
                          name="close-circle-outline"
                          size={18}
                          color="#111"
                        />
                        <Text style={styles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    </View>

                    {!!newPost.image && (
                      <Text style={styles.savedLink} numberOfLines={2}>
                        Saved link: {newPost.image}
                      </Text>
                    )}
                  </View>
                ) : null}

                {/* Content */}
                <Text style={[styles.label, { marginBottom: 8 }]}>Content</Text>
                <View style={styles.editorShell}>
                  <RichToolbar
                    editor={richText}
                    actions={['bold', 'italic', 'insertImage', 'fontSize']}
                  />
                  <RichEditor
                    ref={richText}
                    style={styles.richEditor}
                    initialContentHTML={richEditorContent}
                    onChange={setRichEditorContent}
                    placeholder="Write content here..."
                  />
                </View>

                {/* Actions */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={resetForm}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      uploadingImage && { opacity: 0.7 },
                    ]}
                    onPress={editingPost ? handleUpdatePost : handleCreatePost}
                    disabled={uploadingImage}
                  >
                    <Icon
                      name={editingPost ? 'checkmark' : 'paper-plane-outline'}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.primaryText}>
                      {editingPost ? 'Update' : 'Publish'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>

        {/* Category Picker */}
        <Modal visible={showCategoryPicker} transparent animationType="fade">
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCategoryPicker(false)}
          />

          <View style={styles.pickerSheetWrap}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select category</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(false)}
                  style={styles.closeIcon}
                >
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              {['news', 'announcements', 'decisions', 'reforms', 'events'].map(
                c => {
                  const active = newPost.category === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.pickerItem,
                        active && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setNewPost({ ...newPost, category: c });
                        setShowCategoryPicker(false);
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <View
                          style={[
                            styles.dot,
                            active && { backgroundColor: COLORS.light.primary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.pickerItemText,
                            active && { color: '#111' },
                          ]}
                        >
                          {c.toUpperCase()}
                        </Text>
                      </View>
                      {active && (
                        <Icon
                          name="checkmark"
                          size={18}
                          color={COLORS.light.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F5F7' },

  hero: {
    backgroundColor: '#0E0E10',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  addBtn: { backgroundColor: '#fff', padding: 10, borderRadius: 999 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
  },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(47,165,169,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: COLORS.light.primary, fontWeight: '900', fontSize: 11 },

  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#eee' },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  postTitle: { fontSize: 16, fontWeight: '900', color: '#111' },
  postMeta: { fontSize: 12, color: '#6B6B70', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  stat: { fontSize: 12, fontWeight: '700', color: '#6B6B70' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editBtn: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
    padding: 10,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionText: { color: '#fff', fontWeight: '800' },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
    maxHeight: '90%',
  },

  sheetHeader: { marginBottom: 10 },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E6E7EA',
    marginBottom: 10,
  },

  sheetTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sheetSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B6B70',
  },

  closeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontWeight: '700',
    color: '#111',
  },

  picker: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerText: { fontWeight: '900', color: '#111' },

  uploadBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadTitle: { fontWeight: '900', color: '#111' },
  uploadSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B6B70',
  },

  pickBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickText: { fontWeight: '900', color: '#111' },

  previewWrap: { marginTop: 12 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  previewRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  uploadBtn: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadBtnText: { color: '#fff', fontWeight: '900' },
  clearBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  clearText: { fontWeight: '900', color: '#111' },

  savedLink: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B6B70',
  },

  editorShell: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  richEditor: { height: 220, paddingHorizontal: 8 },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#111', fontWeight: '900' },

  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#fff', fontWeight: '900' },

  pickerSheetWrap: { flex: 1, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
    paddingBottom: 22,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: { fontSize: 16, fontWeight: '900', color: '#111' },

  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerItemActive: { backgroundColor: 'rgba(47,165,169,0.10)' },
  pickerItemText: { fontWeight: '900', color: '#6B6B70' },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#D1D5DB' },
});

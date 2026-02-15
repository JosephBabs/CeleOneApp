import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../../core/theme/colors';

import { db, auth } from '../auth/firebaseConfig';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { launchImageLibrary } from 'react-native-image-picker';

type Room = {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  avatar?: string;
  members?: string[];
  createdAt?: any;
};

const ADMIN_EMAIL = 'bajos3d@gmail.com';

export default function AdminChatrooms({ navigation }: any) {
  const [chatrooms, setChatrooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Sheets
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Delete target
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Password confirm
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [newChatroom, setNewChatroom] = useState({
    name: '',
    description: '',
    isPublic: true,
    avatar: '',
    image: '',
  });

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const searchRef = useRef<TextInput>(null);

  /* ================= Realtime rooms ================= */
  useEffect(() => {
    const qy = query(collection(db, 'chatrooms'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      qy,
      snapshot => {
        const rooms = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as any),
        })) as Room[];
        setChatrooms(rooms);
        setLoading(false);
        setRefreshing(false);
      },
      err => {
        console.error('Error fetching chatrooms:', err);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chatrooms;
    return chatrooms.filter(r => {
      const hay = `${r.name || ''} ${r.description || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chatrooms, search]);

  const onRefresh = async () => {
    // With onSnapshot, refresh is cosmetic (UI). We'll just show the spinner briefly.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const resetForm = () => {
    setNewChatroom({ name: '', description: '', isPublic: true, avatar: '', image: '' });
  };

  /* ================= Create ================= */
  const handleCreateChatroom = async () => {
    if (!newChatroom.name.trim()) {
      Alert.alert('Validation', 'Chatroom name is required');
      return;
    }

    try {
      setBusy(true);
      await addDoc(collection(db, 'chatrooms'), {
        name: newChatroom.name.trim(),
        description: (newChatroom.description || '').trim(),
        isPublic: newChatroom.isPublic,
        avatar: newChatroom.avatar?.trim() || '',
        createdBy: auth.currentUser?.uid || '',
        members: [auth.currentUser?.uid || ''],
        createdAt: serverTimestamp(),
        unreadCount: 0,
        lastMessage: '',
      });

      resetForm();
      setCreateOpen(false);
      Alert.alert('Success', 'Chatroom created successfully');
    } catch (e) {
      console.error('Error creating chatroom:', e);
      Alert.alert('Error', 'Failed to create chatroom');
    } finally {
      setBusy(false);
    }
  };

  /* ================= Edit ================= */
  const openEdit = (room: Room) => {
    setEditingRoom({ ...room });
    setEditOpen(true);
  };

  const handleEditChatroom = async () => {
    if (!editingRoom?.name?.trim()) {
      Alert.alert('Validation', 'Chatroom name is required');
      return;
    }
    try {
      setBusy(true);
      await updateDoc(doc(db, 'chatrooms', editingRoom.id), {
        name: editingRoom.name.trim(),
        description: (editingRoom.description || '').trim(),
        isPublic: !!editingRoom.isPublic,
        avatar: editingRoom.avatar?.trim() || '',
      });

      setEditOpen(false);
      setEditingRoom(null);
      Alert.alert('Success', 'Chatroom updated successfully');
    } catch (e) {
      console.error('Error updating chatroom:', e);
      Alert.alert('Error', 'Failed to update chatroom');
    } finally {
      setBusy(false);
    }
  };

  /* ================= Delete ================= */
  const openDelete = (roomId: string) => {
    setDeletingRoomId(roomId);
    setDeleteOpen(true);
  };

  const continueDelete = () => {
    setDeleteOpen(false);
    setPasswordOpen(true);
  };

  type UploadAsset = {
    uri: string;
    type?: string;
    fileName?: string;
  };
  // upload states
  const [localImage, setLocalImage] = useState<UploadAsset | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const CDN_UPLOAD_ENDPOINT = 'https://cdn.celeonetv.com/api/uploads/posts';
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

  const handleUploadPressed = async ({ type }) => {
    if (!localImage) {
      Alert.alert('Select Image', 'Please choose an image first.');
      return;
    }

    try {
      setUploadingImage(true);
      const url = await uploadImageToCDN(localImage);
      if(type === 'edit'){
        setEditingRoom(p => p ? { ...p, avatar: url } : p); 
      } else {
        setNewChatroom(p => ({ ...p, avatar: url }));
      }
      Alert.alert('Uploaded', 'Image uploaded successfully.');
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteChatroom = async () => {
    if (!password.trim()) {
      Alert.alert('Validation', 'Please enter your password');
      return;
    }
    if (!deletingRoomId) return;

    try {
      setBusy(true);

      // Re-auth (your current approach)
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);

      await deleteDoc(doc(db, 'chatrooms', deletingRoomId));

      Alert.alert('Success', 'Chatroom deleted successfully');
      setPasswordOpen(false);
      setPassword('');
      setDeletingRoomId(null);
    } catch (error: any) {
      console.error('Error deleting chatroom:', error);
      if (
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/user-not-found'
      ) {
        Alert.alert('Error', 'Invalid password');
      } else {
        Alert.alert('Error', 'Failed to delete chatroom');
      }
    } finally {
      setBusy(false);
    }
  };

  /* ================= UI helpers ================= */
  const RoomPill = ({ isPublic }: { isPublic: boolean }) => (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: isPublic
            ? 'rgba(16,185,129,0.12)'
            : 'rgba(245,158,11,0.14)',
        },
      ]}
    >
      <Icon
        name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
        size={14}
        color={isPublic ? '#10B981' : '#F59E0B'}
      />
      <Text
        style={[styles.pillText, { color: isPublic ? '#10B981' : '#F59E0B' }]}
      >
        {isPublic ? 'Public' : 'Private'}
      </Text>
    </View>
  );

  const renderRoom = ({ item }: { item: Room }) => {
    const membersCount = item.members?.length || 0;
    const avatar = item.avatar?.trim();

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.leftRow}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Icon name="chatbubbles-outline" size={18} color="#111" />
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.roomName} numberOfLines={1}>
                  {item.name}
                </Text>
                <RoomPill isPublic={!!item.isPublic} />
              </View>

              <Text style={styles.roomDesc} numberOfLines={2}>
                {item.description?.trim() ? item.description : 'No description'}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Icon name="people-outline" size={14} color="#6B6B70" />
                  <Text style={styles.metaChipText}>
                    {membersCount} members
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionsCol}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => openEdit(item)}
            >
              <Icon name="create-outline" size={18} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                { backgroundColor: 'rgba(239,68,68,0.12)' },
              ]}
              onPress={() => openDelete(item.id)}
            >
              <Icon name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading && chatrooms.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Luxury header */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Chatrooms</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              Create, edit & manage rooms
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setCreateOpen(true);
              setTimeout(() => searchRef.current?.blur(), 200);
            }}
            style={styles.createPill}
            activeOpacity={0.9}
          >
            <Icon name="add" size={18} color="#0E0E10" />
            <Text style={styles.createPillText}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.7)" />
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="Search chatrooms..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              style={styles.clearBtn}
            >
              <Icon name="close" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderRoom}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.light.primary}
            colors={[COLORS.light.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="chatbubbles-outline" size={34} color="#111" />
            </View>
            <Text style={styles.emptyTitle}>No chatrooms found</Text>
            <Text style={styles.emptySub}>
              Try creating a new room or change your search.
            </Text>
          </View>
        }
      />

      {/* ===== CREATE SHEET ===== */}
      <Modal
        isVisible={createOpen}
        onBackdropPress={() => !busy && setCreateOpen(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Create Chatroom</Text>
                <Text style={styles.sheetSub}>
                  Premium settings for your community
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCreateOpen(false)}
                disabled={busy}
                style={styles.sheetClose}
              >
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Chatroom Name *"
              placeholderTextColor="#8C8C8F"
              value={newChatroom.name}
              onChangeText={v => setNewChatroom({ ...newChatroom, name: v })}
            />

            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description (optional)"
              placeholderTextColor="#8C8C8F"
              value={newChatroom.description}
              onChangeText={v =>
                setNewChatroom({ ...newChatroom, description: v })
              }
              multiline
            />

            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Avatar URL (optional)"
              placeholderTextColor="#8C8C8F"
              value={newChatroom.avatar}
              onChangeText={v => setNewChatroom({ ...newChatroom, avatar: v })}
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
            {localImage?.uri || newChatroom.avatar ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: newChatroom.avatar || localImage?.uri }}
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
                        <Text style={styles.uploadBtnText}>Upload to CDN</Text>
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
                    <Icon name="close-circle-outline" size={18} color="#111" />
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                {!!newChatroom.avatar && (
                  <Text style={styles.savedLink} numberOfLines={2}>
                    Saved link: {newChatroom.avatar}
                  </Text>
                )}
              </View>
            ) : null}

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Room Type</Text>
              <View style={styles.toggleWrap}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    newChatroom.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setNewChatroom({ ...newChatroom, isPublic: true })
                  }
                >
                  <Icon
                    name="globe-outline"
                    size={16}
                    color={newChatroom.isPublic ? '#fff' : '#555'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      newChatroom.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !newChatroom.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setNewChatroom({ ...newChatroom, isPublic: false })
                  }
                >
                  <Icon
                    name="lock-closed-outline"
                    size={16}
                    color={!newChatroom.isPublic ? '#fff' : '#555'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      !newChatroom.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#F2F3F5' }]}
                onPress={() => {
                  if (busy) return;
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                <Text style={[styles.btnText, { color: '#444' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: COLORS.light.primary },
                  busy && { opacity: 0.7 },
                ]}
                onPress={handleCreateChatroom}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== EDIT SHEET ===== */}
      <Modal
        isVisible={editOpen}
        onBackdropPress={() => !busy && setEditOpen(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Edit Chatroom</Text>
                <Text style={styles.sheetSub}>
                  Update name, description & privacy
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                disabled={busy}
                style={styles.sheetClose}
              >
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Chatroom Name *"
              placeholderTextColor="#8C8C8F"
              value={editingRoom?.name || ''}
              onChangeText={v =>
                setEditingRoom(p => (p ? { ...p, name: v } : p))
              }
            />

            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description (optional)"
              placeholderTextColor="#8C8C8F"
              value={editingRoom?.description || ''}
              onChangeText={v =>
                setEditingRoom(p => (p ? { ...p, description: v } : p))
              }
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Avatar URL (optional)"
              placeholderTextColor="#8C8C8F"
              value={editingRoom?.avatar || ''}
              onChangeText={v =>
                setEditingRoom(p => (p ? { ...p, avatar: v } : p))
              }
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
            {localImage?.uri || editingRoom?.avatar ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: editingRoom?.avatar || localImage?.uri }}
                  style={styles.preview}
                />
                <View style={styles.previewRow}>
                  <TouchableOpacity
                    style={[
                      styles.uploadBtn,
                      uploadingImage && { opacity: 0.6 },
                    ]}
                    onPress={() => handleUploadPressed({ type: 'edit' })}
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
                        <Text style={styles.uploadBtnText}>Upload to CDN</Text>
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
                    <Icon name="close-circle-outline" size={18} color="#111" />
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                {!!editingRoom?.avatar && (
                  <Text style={styles.savedLink} numberOfLines={2}>
                    Saved link: {editingRoom?.avatar}
                  </Text>
                )}
              </View>
            ) : null}

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Room Type</Text>
              <View style={styles.toggleWrap}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !!editingRoom?.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setEditingRoom(p => (p ? { ...p, isPublic: true } : p))
                  }
                >
                  <Icon
                    name="globe-outline"
                    size={16}
                    color={!!editingRoom?.isPublic ? '#fff' : '#555'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      !!editingRoom?.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !editingRoom?.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setEditingRoom(p => (p ? { ...p, isPublic: false } : p))
                  }
                >
                  <Icon
                    name="lock-closed-outline"
                    size={16}
                    color={!editingRoom?.isPublic ? '#fff' : '#555'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      !editingRoom?.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#F2F3F5' }]}
                onPress={() => {
                  if (busy) return;
                  setEditOpen(false);
                  setEditingRoom(null);
                }}
              >
                <Text style={[styles.btnText, { color: '#444' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: COLORS.light.primary },
                  busy && { opacity: 0.7 },
                ]}
                onPress={handleEditChatroom}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== DELETE CONFIRM SHEET ===== */}
      <Modal
        isVisible={deleteOpen}
        onBackdropPress={() => !busy && setDeleteOpen(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Delete chatroom?</Text>
              <Text style={styles.sheetSub}>This action cannot be undone.</Text>
            </View>
            <TouchableOpacity
              onPress={() => setDeleteOpen(false)}
              disabled={busy}
              style={styles.sheetClose}
            >
              <Icon name="close" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          <View style={styles.dangerBox}>
            <Icon name="warning-outline" size={18} color="#B91C1C" />
            <Text style={styles.dangerText}>
              You will permanently delete this room and its metadata.
            </Text>
          </View>

          <View style={styles.sheetBtns}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#F2F3F5' }]}
              onPress={() => setDeleteOpen(false)}
            >
              <Text style={[styles.btnText, { color: '#444' }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#EF4444' }]}
              onPress={continueDelete}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== PASSWORD SHEET ===== */}
      <Modal
        isVisible={passwordOpen}
        onBackdropPress={() => !busy && setPasswordOpen(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Confirm password</Text>
                <Text style={styles.sheetSub}>
                  Required to delete this chatroom
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPasswordOpen(false)}
                disabled={busy}
                style={styles.sheetClose}
              >
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#8C8C8F"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#F2F3F5' }]}
                onPress={() => {
                  if (busy) return;
                  setPasswordOpen(false);
                  setPassword('');
                }}
              >
                <Text style={[styles.btnText, { color: '#444' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: '#EF4444' },
                  busy && { opacity: 0.7 },
                ]}
                onPress={handleDeleteChatroom}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },

  hero: {
    backgroundColor: '#0E0E10',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 12.5,
  },

  createPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  createPillText: { fontWeight: '900', color: '#0E0E10', fontSize: 13 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontWeight: '800' },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // upload function here

  label: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
    marginTop: 12,
    marginLeft: 14,
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

  previewWrap: { marginTop: 12, padding: 14 },
  preview: {
    width: '100%',
    height: 100,
    padding: 12,
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

  clearText: { fontWeight: '900', color: '#111' },

  savedLink: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B6B70',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  leftRow: { flexDirection: 'row', gap: 12, flex: 1 },

  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F2F3F5',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roomName: { flex: 1, fontWeight: '900', color: '#111', fontSize: 15.5 },
  roomDesc: {
    marginTop: 6,
    color: '#6B6B70',
    fontWeight: '700',
    lineHeight: 18,
    fontSize: 12.8,
  },

  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6F7F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaChipText: { fontWeight: '800', color: '#6B6B70', fontSize: 12 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillText: { fontWeight: '900', fontSize: 12 },

  actionsCol: { gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { paddingTop: 50, alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, fontWeight: '900', fontSize: 16, color: '#111' },
  emptySub: {
    marginTop: 6,
    fontWeight: '700',
    color: '#6B6B70',
    textAlign: 'center',
  },

  // Sheets
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sheetSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B6B70',
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#F6F7F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '800',
    color: '#111',
  },
  textarea: { minHeight: 92, textAlignVertical: 'top' },

  toggleRow: { marginTop: 14, paddingHorizontal: 16 },
  toggleLabel: { fontWeight: '900', color: '#111', marginBottom: 10 },
  toggleWrap: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtnActive: { backgroundColor: '#111' },
  toggleText: { fontWeight: '900', color: '#555' },
  toggleTextActive: { color: '#fff' },

  sheetBtns: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '900', fontSize: 14 },

  dangerBox: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dangerText: { flex: 1, color: '#B91C1C', fontWeight: '800', lineHeight: 18 },
});

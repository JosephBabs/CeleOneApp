import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import { Platform, Linking } from 'react-native';


import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

import * as ImagePicker from 'react-native-image-picker';

/* ================= TYPES ================= */

export interface Music {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: string;
  coverUrl?: string;
  audioUrl?: string;
  description?: string;
}

export interface Film {
  id: string;
  title: string;
  director: string;
  genre?: string;
  duration?: string;
  coverUrl?: string;
  videoUrl?: string;
  description?: string;
  cast?: string;
  rating?: string;
}

type ContentType = 'music' | 'film';

/* ================= COMPONENT ================= */

const AdminMusicAndFilms: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();

  const [loading, setLoading] = useState<boolean>(true);
  const [contentType, setContentType] = useState<ContentType>('music');

  const [musics, setMusics] = useState<Music[]>([]);
  const [films, setFilms] = useState<Film[]>([]);

  const [editingItem, setEditingItem] = useState<Music | Film | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newMusic, setNewMusic] = useState<Partial<Music>>({});
  const [newFilm, setNewFilm] = useState<Partial<Film>>({});

  /* ================= FETCH ================= */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [musicSnap, filmSnap] = await Promise.all([
        getDocs(collection(db, 'songs')),
        getDocs(collection(db, 'videos')),
      ]);

      setMusics(musicSnap.docs.map(d => ({ id: d.id, ...d.data() } as Music)));

      setFilms(filmSnap.docs.map(d => ({ id: d.id, ...d.data() } as Film)));
    } catch {
      Alert.alert('Error', 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

 
  /* ================= IMAGE PICKER ================= */




  /* ================= CREATE ================= */

  const createMusic = async () => {
    if (!newMusic.title || !newMusic.artist) {
      Alert.alert('Validation', 'Title and Artist required');
      return;
    }

    await addDoc(collection(db, 'songs'), {
      ...newMusic,
      createdBy: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
    });

    setNewMusic({});
    setShowCreateModal(false);
    fetchData();
  };

  const createFilm = async () => {
    if (!newFilm.title || !newFilm.director) {
      Alert.alert('Validation', 'Title and Director required');
      return;
    }

    await addDoc(collection(db, 'videos'), {
      ...newFilm,
      createdBy: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
    });

    setNewFilm({});
    setShowCreateModal(false);
    fetchData();
  };

  /* ================= UPDATE ================= */

  const updateItem = async () => {
    if (!editingItem) return;

    const ref =
      'artist' in editingItem
        ? doc(db, 'songs', editingItem.id)
        : doc(db, 'videos', editingItem.id);

    await updateDoc(ref, {
      ...(contentType === 'music' ? newMusic : newFilm),
      updatedAt: serverTimestamp(),
    });

    setEditingItem(null);
    setShowEditModal(false);
    fetchData();
  };

  /* ================= DELETE ================= */

  const deleteItem = async (type: 'songs' | 'videos', id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, type, id));
          fetchData();
        },
      },
    ]);
  };

  /* ================= OPEN EDIT MODAL ================= */

  const openEditModal = (item: Music | Film) => {
    setEditingItem(item);
    setContentType('artist' in item ? 'music' : 'film');

    if ('artist' in item) {
      setNewMusic(item);
    } else {
      setNewFilm(item);
    }

    setShowEditModal(true);
  };

  /* ================= OPEN CREATE MODAL ================= */

  const openCreateModal = () => {
    if (contentType === 'music') {
      setNewMusic({});
    } else {
      setNewFilm({});
    }
    setShowCreateModal(true);
  };

  /* ================= RENDER ITEM ================= */

  const renderItem = ({ item }: { item: Music | Film }) => (
    <View style={styles.card1}>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.iconBox} />
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name="musical-notes" size={24} color="#777" />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.title}</Text>
        <Text style={styles.desc}>
          {'artist' in item ? item.artist : item.director}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEditModal(item)}>
          <Ionicons
            name="create-outline"
            size={20}
            color={COLORS.light.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            deleteItem('artist' in item ? 'songs' : 'videos', item.id)
          }
        >
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ================= UI ================= */

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.title}>Music & Films</Text>

        <TouchableOpacity onPress={openCreateModal}>
          <Ionicons name="add-circle" size={24} color={COLORS.light.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <TouchableOpacity
          style={[
            styles.sectionButton,
            contentType === 'music' && styles.activeSectionButton,
          ]}
          onPress={() => setContentType('music')}
        >
          <Text
            style={[
              styles.sectionButtonText,
              contentType === 'music' && styles.activeSectionButtonText,
            ]}
          >
            Music
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sectionButton,
            contentType === 'film' && styles.activeSectionButton,
          ]}
          onPress={() => setContentType('film')}
        >
          <Text
            style={[
              styles.sectionButtonText,
              contentType === 'film' && styles.activeSectionButtonText,
            ]}
          >
            Films
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      ) : (
        <FlatList
          data={contentType === 'music' ? musics : films}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {contentType === 'music'
                  ? 'No music added yet'
                  : 'No films added yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {contentType === 'music' ? 'Add New Music' : 'Add New Film'}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Cover Image */}
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={() => pickImage(false)}
              >
                {contentType === 'music' ? (
                  newMusic.coverUrl ? (
                    <Image
                      source={{ uri: newMusic.coverUrl }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image" size={40} color="#999" />
                      <Text style={styles.imagePlaceholderText}>
                        Tap to select cover image
                      </Text>
                    </View>
                  )
                ) : newFilm.coverUrl ? (
                  <Image
                    source={{ uri: newFilm.coverUrl }}
                    style={styles.coverImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image" size={40} color="#999" />
                    <Text style={styles.imagePlaceholderText}>
                      Tap to select cover image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Music Form */}
              {contentType === 'music' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.title}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, title: text })
                      }
                      placeholder="Enter music title"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Artist *</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.artist}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, artist: text })
                      }
                      placeholder="Enter artist name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Album</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.album}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, album: text })
                      }
                      placeholder="Enter album name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Genre</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.genre}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, genre: text })
                      }
                      placeholder="Enter genre"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Duration</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.duration}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, duration: text })
                      }
                      placeholder="Enter duration (e.g., 3:45)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Audio URL</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.audioUrl}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, audioUrl: text })
                      }
                      placeholder="Enter audio URL"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.textarea}
                      value={newMusic.description}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, description: text })
                      }
                      placeholder="Enter description"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={createMusic}
                  >
                    <Text style={styles.primaryText}>Add Music</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Film Form */}
              {contentType === 'film' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.title}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, title: text })
                      }
                      placeholder="Enter film title"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Director *</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.director}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, director: text })
                      }
                      placeholder="Enter director name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Genre</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.genre}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, genre: text })
                      }
                      placeholder="Enter genre"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Duration</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.duration}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, duration: text })
                      }
                      placeholder="Enter duration (e.g., 2h 15m)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Video URL</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.videoUrl}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, videoUrl: text })
                      }
                      placeholder="Enter video URL"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Cast</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.cast}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, cast: text })
                      }
                      placeholder="Enter cast members"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Rating</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.rating}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, rating: text })
                      }
                      placeholder="Enter rating (e.g., PG-13, R)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.textarea}
                      value={newFilm.description}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, description: text })
                      }
                      placeholder="Enter description"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={createFilm}
                  >
                    <Text style={styles.primaryText}>Add Film</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {contentType === 'music' ? 'Edit Music' : 'Edit Film'}
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Cover Image */}
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={() => pickImage(true)}
              >
                {contentType === 'music' ? (
                  newMusic.coverUrl ? (
                    <Image
                      source={{ uri: newMusic.coverUrl }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image" size={40} color="#999" />
                      <Text style={styles.imagePlaceholderText}>
                        Tap to select cover image
                      </Text>
                    </View>
                  )
                ) : newFilm.coverUrl ? (
                  <Image
                    source={{ uri: newFilm.coverUrl }}
                    style={styles.coverImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image" size={40} color="#999" />
                    <Text style={styles.imagePlaceholderText}>
                      Tap to select cover image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Music Form */}
              {contentType === 'music' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.title}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, title: text })
                      }
                      placeholder="Enter music title"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Artist *</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.artist}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, artist: text })
                      }
                      placeholder="Enter artist name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Album</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.album}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, album: text })
                      }
                      placeholder="Enter album name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Genre</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.genre}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, genre: text })
                      }
                      placeholder="Enter genre"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Duration</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.duration}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, duration: text })
                      }
                      placeholder="Enter duration (e.g., 3:45)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Audio URL</Text>
                    <TextInput
                      style={styles.input}
                      value={newMusic.audioUrl}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, audioUrl: text })
                      }
                      placeholder="Enter audio URL"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.textarea}
                      value={newMusic.description}
                      onChangeText={text =>
                        setNewMusic({ ...newMusic, description: text })
                      }
                      placeholder="Enter description"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={updateItem}
                  >
                    <Text style={styles.primaryText}>Update Music</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Film Form */}
              {contentType === 'film' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.title}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, title: text })
                      }
                      placeholder="Enter film title"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Director *</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.director}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, director: text })
                      }
                      placeholder="Enter director name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Genre</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.genre}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, genre: text })
                      }
                      placeholder="Enter genre"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Duration</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.duration}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, duration: text })
                      }
                      placeholder="Enter duration (e.g., 2h 15m)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Video URL</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.videoUrl}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, videoUrl: text })
                      }
                      placeholder="Enter video URL"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Cast</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.cast}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, cast: text })
                      }
                      placeholder="Enter cast members"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Rating</Text>
                    <TextInput
                      style={styles.input}
                      value={newFilm.rating}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, rating: text })
                      }
                      placeholder="Enter rating (e.g., PG-13, R)"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.textarea}
                      value={newFilm.description}
                      onChangeText={text =>
                        setNewFilm({ ...newFilm, description: text })
                      }
                      placeholder="Enter description"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={updateItem}
                  >
                    <Text style={styles.primaryText}>Update Film</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  title: { fontSize: 20, fontWeight: '600' },

  sectionContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 4,
  },

  sectionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  activeSectionButton: {
    backgroundColor: COLORS.light.primary,
  },

  sectionButtonText: {
    color: '#333',
    fontWeight: '600',
  },

  activeSectionButtonText: {
    color: '#fff',
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

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },

  emptyText: {
    color: '#999',
    fontSize: 16,
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

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalTitle: { fontSize: 18, fontWeight: '600' },

  formContainer: {
    marginBottom: 20,
  },

  formGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },

  input: {
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  textarea: {
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    padding: 14,
    height: 100,
    marginBottom: 12,
    textAlignVertical: 'top',
  },

  imagePicker: {
    height: 200,
    backgroundColor: '#f3f3f3',
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  imagePlaceholderText: {
    color: '#999',
    marginTop: 10,
  },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8,
  },

  primaryText: { color: '#fff', fontWeight: '600' },
});

export default AdminMusicAndFilms;

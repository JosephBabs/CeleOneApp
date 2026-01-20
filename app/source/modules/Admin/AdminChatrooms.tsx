import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { db, auth } from "../auth/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminChatrooms({ navigation }: any) {
  const [chatrooms, setChatrooms] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [editingRoom, setEditingRoom] = useState<any>(null);

  const [newChatroom, setNewChatroom] = useState({
    name: "",
    description: "",
    isPublic: true,
    avatar: "",
    createdBy: auth.currentUser?.uid || "",
    members: [auth.currentUser?.uid || ""],
  });

  useEffect(() => {
    fetchChatrooms();
  }, []);

  const fetchChatrooms = async () => {
    try {
      setLoading(true);
      const chatroomsCollection = collection(db, "chatrooms");
      
      const unsubscribe = onSnapshot(chatroomsCollection, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setChatrooms(rooms);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching chatrooms:", error);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewChatroom({
      name: "",
      description: "",
      isPublic: true,
      avatar: "",
      createdBy: auth.currentUser?.uid || "",
      members: [auth.currentUser?.uid || ""],
    });
  };

  const handleCreateChatroom = async () => {
    if (!newChatroom.name.trim()) {
      Alert.alert("Validation", "Chatroom name is required");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "chatrooms"), {
        name: newChatroom.name,
        description: newChatroom.description,
        isPublic: newChatroom.isPublic,
        avatar: newChatroom.avatar || "",
        createdBy: auth.currentUser?.uid,
        members: [auth.currentUser?.uid],
        createdAt: serverTimestamp(),
        unreadCount: 0,
        lastMessage: "",
      });

      resetForm();
      setShowCreateForm(false);
      Alert.alert("Success", "Chatroom created successfully");
      setLoading(false);
    } catch (error) {
      console.error("Error creating chatroom:", error);
      Alert.alert("Error", "Failed to create chatroom");
      setLoading(false);
    }
  };

  const handleEditChatroom = async () => {
    if (!editingRoom || !editingRoom.name.trim()) {
      Alert.alert("Validation", "Chatroom name is required");
      return;
    }

    try {
      setLoading(true);
      const roomRef = doc(db, "chatrooms", editingRoom.id);
      await updateDoc(roomRef, {
        name: editingRoom.name,
        description: editingRoom.description,
        isPublic: editingRoom.isPublic,
        avatar: editingRoom.avatar,
      });

      setShowEditForm(false);
      setEditingRoom(null);
      Alert.alert("Success", "Chatroom updated successfully");
      setLoading(false);
    } catch (error) {
      console.error("Error updating chatroom:", error);
      Alert.alert("Error", "Failed to update chatroom");
      setLoading(false);
    }
  };

  const openDeleteModal = (roomId: string) => {
    setDeletingRoomId(roomId);
    setShowDeleteModal(true);
  };

  const openPasswordModal = () => {
    setShowDeleteModal(false);
    setShowPasswordModal(true);
  };

  const handleDeleteChatroom = async () => {
    if (!password.trim()) {
      Alert.alert("Validation", "Please enter your password");
      return;
    }

    try {
      setLoading(true);
      // Authenticate with admin email
      await signInWithEmailAndPassword(auth, "bajos3d@gmail.com", password);
      
      // Delete the chatroom
      if (deletingRoomId) {
        await deleteDoc(doc(db, "chatrooms", deletingRoomId));
        Alert.alert("Success", "Chatroom deleted successfully");
      }

      setShowPasswordModal(false);
      setPassword("");
      setDeletingRoomId(null);
      setLoading(false);
    } catch (error: any) {
      console.error("Error deleting chatroom:", error);
      if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        Alert.alert("Error", "Invalid password");
      } else {
        Alert.alert("Error", "Failed to delete chatroom");
      }
      setLoading(false);
    }
  };

  const openEditForm = (room: any) => {
    setEditingRoom({ ...room });
    setShowEditForm(true);
  };

  const renderChatroomItem = ({ item }: any) => (
    <View style={styles.chatroomCard}>
      <View style={styles.chatroomHeader}>
        <View style={styles.chatroomInfo}>
          <Text style={styles.chatroomName}>{item.name}</Text>
          <Text style={styles.chatroomDescription} numberOfLines={2}>
            {item.description || "No description"}
          </Text>
        </View>
        <View style={[styles.badge, item.isPublic ? styles.publicBadge : styles.privateBadge]}>
          <Icon name={item.isPublic ? "globe-outline" : "lock-closed"} size={14} color="#fff" />
          <Text style={styles.badgeText}>
            {item.isPublic ? "Public" : "Private"}
          </Text>
        </View>
      </View>

      <View style={styles.chatroomMeta}>
        <Text style={styles.metaText}>
          Members: <Text style={styles.metaValue}>{item.members?.length || 0}</Text>
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openEditForm(item)}
        >
          <Icon name="pencil" size={16} color="#fff" />
          <Text style={styles.btnText}> Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => openDeleteModal(item.id)}
        >
          <Icon name="trash" size={16} color="#fff" />
          <Text style={styles.btnText}> Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && chatrooms.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Manage Chatrooms</Text>
      </View>

      {/* CREATE BUTTON */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowCreateForm(!showCreateForm)}
      >
        <Icon name="add-circle" size={20} color="#fff" />
        <Text style={styles.createText}>Create New Chatroom</Text>
      </TouchableOpacity>

      {/* CREATE FORM */}
      {showCreateForm && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Create Chatroom</Text>

            <TextInput
              style={styles.input}
              placeholder="Chatroom Name *"
              value={newChatroom.name}
              onChangeText={(text) => setNewChatroom({ ...newChatroom, name: text })}
              placeholderTextColor="#999"
            />

            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description (optional)"
              value={newChatroom.description}
              onChangeText={(text) => setNewChatroom({ ...newChatroom, description: text })}
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.input}
              placeholder="Avatar URL (optional)"
              value={newChatroom.avatar}
              onChangeText={(text) => setNewChatroom({ ...newChatroom, avatar: text })}
              placeholderTextColor="#999"
            />

            {/* PUBLIC/PRIVATE TOGGLE */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Room Type:</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    newChatroom.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() => setNewChatroom({ ...newChatroom, isPublic: true })}
                >
                  <Icon name="globe-outline" size={18} color={newChatroom.isPublic ? "#fff" : "#666"} />
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
                  onPress={() => setNewChatroom({ ...newChatroom, isPublic: false })}
                >
                  <Icon name="lock-closed" size={18} color={!newChatroom.isPublic ? "#fff" : "#666"} />
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

            {/* FORM BUTTONS */}
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handleCreateChatroom}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* EDIT FORM */}
      {showEditForm && editingRoom && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Edit Chatroom</Text>

            <TextInput
              style={styles.input}
              placeholder="Chatroom Name *"
              value={editingRoom.name}
              onChangeText={(text) => setEditingRoom({ ...editingRoom, name: text })}
              placeholderTextColor="#999"
            />

            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description (optional)"
              value={editingRoom.description}
              onChangeText={(text) => setEditingRoom({ ...editingRoom, description: text })}
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.input}
              placeholder="Avatar URL (optional)"
              value={editingRoom.avatar}
              onChangeText={(text) => setEditingRoom({ ...editingRoom, avatar: text })}
              placeholderTextColor="#999"
            />

            {/* PUBLIC/PRIVATE TOGGLE */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Room Type:</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    editingRoom.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() => setEditingRoom({ ...editingRoom, isPublic: true })}
                >
                  <Icon name="globe-outline" size={18} color={editingRoom.isPublic ? "#fff" : "#666"} />
                  <Text
                    style={[
                      styles.toggleText,
                      editingRoom.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !editingRoom.isPublic && styles.toggleBtnActive,
                  ]}
                  onPress={() => setEditingRoom({ ...editingRoom, isPublic: false })}
                >
                  <Icon name="lock-closed" size={18} color={!editingRoom.isPublic ? "#fff" : "#666"} />
                  <Text
                    style={[
                      styles.toggleText,
                      !editingRoom.isPublic && styles.toggleTextActive,
                    ]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* FORM BUTTONS */}
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowEditForm(false);
                  setEditingRoom(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handleEditChatroom}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* CHATROOMS LIST */}
      <FlatList
        data={chatrooms}
        keyExtractor={(item) => item.id}
        renderItem={renderChatroomItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No chatrooms yet</Text>
          </View>
        }
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal transparent visible={showDeleteModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Chatroom?</Text>
            <Text style={styles.modalText}>
              This action cannot be undone. Enter your password to confirm deletion.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={openPasswordModal}
              >
                <Text style={styles.submitText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal transparent visible={showPasswordModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Password</Text>
            <Text style={styles.modalText}>
              Enter your password to delete this chatroom
            </Text>

            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, loading && { opacity: 0.5 }]}
                onPress={handleDeleteChatroom}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  backText: {
    color: COLORS.light.primary,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.light.primary,
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.light.primary,
    margin: 16,
    padding: 14,
    borderRadius: 8,
  },

  createText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  form: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },

  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: COLORS.light.primary,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },

  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  toggleContainer: {
    marginBottom: 16,
  },

  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },

  toggleButtons: {
    flexDirection: "row",
    gap: 10,
  },

  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: "#f9f9f9",
  },

  toggleBtnActive: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },

  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginLeft: 6,
  },

  toggleTextActive: {
    color: "#fff",
  },

  formButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },

  cancelText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },

  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: COLORS.light.primary,
    alignItems: "center",
  },

  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  list: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  chatroomCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },

  chatroomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  chatroomInfo: {
    flex: 1,
    marginRight: 10,
  },

  chatroomName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#050505",
  },

  chatroomDescription: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },

  publicBadge: {
    backgroundColor: "#4CAF50",
  },

  privateBadge: {
    backgroundColor: "#FF9800",
  },

  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  chatroomMeta: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  metaText: {
    fontSize: 12,
    color: "#666",
  },

  metaValue: {
    fontWeight: "bold",
    color: COLORS.light.primary,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },

  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007bff",
    paddingVertical: 10,
    borderRadius: 6,
  },

  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc3545",
    paddingVertical: 10,
    borderRadius: 6,
  },

  btnText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 12,
  },

  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },

  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    elevation: 5,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.light.primary,
    marginBottom: 10,
  },

  modalText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },

  passwordInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    fontSize: 14,
  },

  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
});

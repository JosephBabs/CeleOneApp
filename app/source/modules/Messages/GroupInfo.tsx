// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Image,
//   Switch,
//   Alert,
//   Share,
//   Modal,
//   // ScrollView,
//   FlatList,
//   // Dimensions,
// } from "react-native";
// // import { Ionicons } from "@expo/vector-icons";
// import Ionicons from "react-native-vector-icons/Ionicons";
// // import { useSafeAreaInsets } from "react-native-safe-area-context";
// import Animated, {
//   useSharedValue,
//   useAnimatedScrollHandler,
//   useAnimatedStyle,
//   interpolate,
//   Extrapolate,
// } from "react-native-reanimated";
// import { COLORS } from "../../../core/theme/colors";
// // import { COLORS } from "../theme/colors";

// const membersMock = [
//   { id: "1", name: "John Doe", avatar: "https://i.pravatar.cc/100?img=1" },
//   { id: "2", name: "Jane Smith", avatar: "https://i.pravatar.cc/100?img=2" },
//   { id: "3", name: "Ahmed Bello", avatar: "https://i.pravatar.cc/100?img=3" },
//   { id: "4", name: "Linda Okoro", avatar: "https://i.pravatar.cc/100?img=4" },
//   { id: "5", name: "Carlos Lopez", avatar: "https://i.pravatar.cc/100?img=5" },
//   // add more...
// ];

// export default function GroupInfo({ route, navigation }: any) {
//   const { chatName, chatAvatar } = route.params;
//   const [isMuted, setIsMuted] = useState(false);
//   const [showMembersModal, setShowMembersModal] = useState(false);
//   // const insets = useSafeAreaInsets();

//   const HEADER_EXPANDED_HEIGHT = 250;
//   const HEADER_COLLAPSED_HEIGHT = 70;

//   const scrollY = useSharedValue(0);

//   const scrollHandler = useAnimatedScrollHandler({
//     onScroll: (event) => {
//       scrollY.value = event.contentOffset.y;
//     },
//   });

//   const animatedHeaderStyle = useAnimatedStyle(() => ({
//     height: interpolate(
//       scrollY.value,
//       [0, HEADER_EXPANDED_HEIGHT - HEADER_COLLAPSED_HEIGHT],
//       [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT],
//       Extrapolate.CLAMP
//     ),
//   }));

//   const animatedImageStyle = useAnimatedStyle(() => {
//     const size = interpolate(scrollY.value, [0, 180], [100, 40], Extrapolate.CLAMP);
//     const radius = interpolate(scrollY.value, [0, 180], [50, 20], Extrapolate.CLAMP);
//     return { width: size, height: size, borderRadius: radius };
//   });

//   const handleShareGroupLink = async () => {
//     const link = "https://yourapp.com/group/xyz123";
//     await Share.share({ message: link });
//   };

//   const handleExitGroup = () => {
//     Alert.alert("Exit Group", "Are you sure you want to exit?", [
//       { text: "Cancel", style: "cancel" },
//       { text: "Exit", style: "destructive", onPress: () => navigation.goBack() },
//     ]);
//   };

//   const handleDeleteConversation = () => {
//     Alert.alert("Delete", "Delete this conversation?", [
//       { text: "Cancel", style: "cancel" },
//       { text: "Delete", style: "destructive", onPress: () => {} },
//     ]);
//   };

//   const handleReportGroup = () => {
//     Alert.alert("Report Group", "This will notify the admin", [
//       { text: "Cancel", style: "cancel" },
//       { text: "Report", style: "default", onPress: () => {} },
//     ]);
//   };

//   return (
//     <View style={{ flex: 1, backgroundColor: "#fff" }}>
//       <Animated.View style={[styles.header, animatedHeaderStyle]}>
//         <View style={styles.headerTop}>
//           <TouchableOpacity onPress={() => navigation.goBack()}>
//             <Ionicons name="arrow-back" size={24} color="#000" />
//           </TouchableOpacity>
//         </View>
//         <Animated.Image source={{ uri: chatAvatar }} style={[styles.avatar, animatedImageStyle]} />
//         <Text style={styles.groupName}>{chatName}</Text>
//         <Text style={styles.groupDesc}>Public Group • 23,421 members</Text>
//       </Animated.View>

//       <Animated.ScrollView
//         contentContainerStyle={{ paddingBottom: 30 }}
//         showsVerticalScrollIndicator={false}
//         onScroll={scrollHandler}
//         scrollEventThrottle={16}
//       >
//         <View style={styles.optionRow}>
//           <Ionicons name="notifications-off-outline" size={22} color="#555" />
//           <Text style={styles.optionText}>Mute Notifications</Text>
//           <Switch
//             value={isMuted}
//             onValueChange={setIsMuted}
//             thumbColor={isMuted ? COLORS.light.primary : "#ccc"}
//           />
//         </View>

//         <TouchableOpacity style={styles.optionRow} onPress={handleShareGroupLink}>
//           <Ionicons name="link-outline" size={22} color="#555" />
//           <Text style={styles.optionText}>Group Invite Link</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.optionRow}
//           onPress={() => setShowMembersModal(true)}
//         >
//           <Ionicons name="people-outline" size={22} color="#555" />
//           <Text style={styles.optionText}>View Group Members</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.optionRow} onPress={handleDeleteConversation}>
//           <Ionicons name="trash-outline" size={22} color="orangered" />
//           <Text style={[styles.optionText, { color: "orangered" }]}>Delete Conversation</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.optionRow} onPress={handleReportGroup}>
//           <Ionicons name="flag-outline" size={22} color="tomato" />
//           <Text style={[styles.optionText, { color: "tomato" }]}>Report Group</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={[styles.optionRow, { marginTop: 20 }]} onPress={handleExitGroup}>
//           <Ionicons name="exit-outline" size={22} color="red" />
//           <Text style={[styles.optionText, { color: "red" }]}>Exit Group</Text>
//         </TouchableOpacity>
//       </Animated.ScrollView>

//       {/* Group Members Modal */}
//       <Modal visible={showMembersModal} animationType="slide" onRequestClose={() => setShowMembersModal(false)}>
//         <View style={styles.modalContainer}>
//           <View style={styles.modalHeader}>
//             <Text style={styles.modalTitle}>Group Members</Text>
//             <TouchableOpacity onPress={() => setShowMembersModal(false)}>
//               <Ionicons name="close" size={26} color="#000" />
//             </TouchableOpacity>
//           </View>
//           <FlatList
//             data={membersMock}
//             keyExtractor={(item) => item.id}
//             renderItem={({ item }) => (
//               <View style={styles.memberItem}>
//                 <Image source={{ uri: item.avatar }} style={styles.memberAvatar} />
//                 <Text style={styles.memberName}>{item.name}</Text>
//               </View>
//             )}
//           />
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   header: {
//     alignItems: "center",
//     justifyContent: "flex-end",
//     paddingTop: 40,
//     paddingBottom: 20,
//     backgroundColor: "#f5faff",
//     borderBottomWidth: 0.4,
//     borderColor: "#ccc",
//     overflow: "hidden",
//   },
//   headerTop: {
//     flexDirection: "row",
//     alignSelf: "flex-start",
//     alignItems: "center",
//     position: "absolute",
//     top: 40,
//     left: 16,
//   },
//   avatar: {
//     marginTop: 10,
//     marginBottom: 5,
//   },
//   groupName: {
//     fontSize: 18,
//     fontWeight: "bold",
//   },
//   groupDesc: {
//     color: "#666",
//     fontSize: 13,
//     marginTop: 2,
//   },
//   optionRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 14,
//     borderBottomWidth: 0.5,
//     borderColor: "#eee",
//   },
//   optionText: {
//     flex: 1,
//     fontSize: 16,
//     marginLeft: 14,
//   },
//   modalContainer: {
//     flex: 1,
//     backgroundColor: "#fff",
//     paddingTop: 60,
//   },
//   modalHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     paddingHorizontal: 20,
//     paddingBottom: 10,
//     borderBottomWidth: 0.5,
//     borderColor: "#ddd",
//   },
//   modalTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//   },
//   memberItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//     borderBottomWidth: 0.5,
//     borderColor: "#f0f0f0",
//   },
//   memberAvatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     marginRight: 12,
//   },
//   memberName: {
//     fontSize: 16,
//   },
// });

import { StyleSheet } from "react-native";
import { COLORS } from "../../../core/theme/colors";
// import { COLORS } from "";

export default StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  headerGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  chatBg: {
    flex: 1,
    backgroundColor: "#F5FAFD", // bluish-teal fallback
    position: "relative",
  },
  
  chatTiledBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    zIndex: 0,
  },
  
  chatList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  rowLeft: { alignSelf: "flex-start" },
  rowRight: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 6,
  },
  username: {
    fontSize: 11,
    color: "#555",
    fontWeight: "600",
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: "#AECFDF",
    borderBottomRightRadius: 4,
    elevation: 0.4
  },
  otherBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    elevation: 0.4
  },
  messageText: {
    fontSize: 15,
    color: "#000",
  },
  timestamp: {
    fontSize: 11,
    color: "#888",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  imageMessage: {
    width: 180,
    height: 120,
    borderRadius: 10,
    marginBottom: 5,
  },
  replyBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#2FA5A9",
    backgroundColor: "#BEF3FF",
    paddingLeft: 6,
    padding: 6,
    marginBottom: 4,
  },
  replyLabel: {
    fontSize: 12,
    color: "#555",
  },
  replyText: {
    fontSize: 13,
    color: "#333",
  },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#BEF3FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2FA5A9",
  },
  replyPreviewText: {
    color: "#444",
    fontSize: 13,
    flex: 1,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    marginHorizontal: 10,
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  attachmentSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 4,              // Android shadow
    shadowColor: "#000",       // iOS shadow
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  
  
  attachmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    // gap: 1
  },
  attachmentCard: {
    width: "23%", // 2 items per row with some space
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 15,
    margin:1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  attachmentLabel: {
    marginTop: 8,
    fontSize: 10,
    color: COLORS.light.primary,
    fontWeight: "600",
  },
  attachmentCancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  attachmentCancel: {
    fontSize: 18,
    color: "#ff4444",
    fontWeight: "600",
  },
  attachmentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  attachmentText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#333",
  },

  // Added missing styles:
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  extraImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  docMessageContainer: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#e0f7fa", // light teal-ish for docs
    borderWidth: 1,
    borderColor: "#00acc1",
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docMessageText: {
    flex: 1,
    fontSize: 15,
    color: "#007c91",
  },
  docIcon: {
    marginRight: 8,
  },
  attachmentCancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
    marginTop: 10,
    borderRadius: 12,
  },
  
  attachmentCancelText: {
    fontSize: 18,
    color: "#ff4444",
    fontWeight: "600",
  },
    
});

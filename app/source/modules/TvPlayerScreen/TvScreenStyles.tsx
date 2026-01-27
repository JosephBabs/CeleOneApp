import { StyleSheet, Dimensions } from "react-native";
import { COLORS } from "../../../core/theme/colors";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D", // Dark background like the Dribbble image
  },
  channelSelectorcard: {
    marginTop: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  channelSelector: {
    marginTop: 20,
    paddingHorizontal: 10,
    
    marginBottom: 30,
    height: 50,
  },
  channelButton: {
    marginRight: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    maxHeight: 40,
    marginBottom: 20,
    height: 30,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
  },
  channelButtonActive: {
    backgroundColor: COLORS.light.primary,
  },
  channelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  channelButtonTextActive: {
    color: "#0D0D0D",
    fontWeight: "700",
  },
  tvFrame: {
    marginTop: 20,
    width: width - 40,
    height: (width - 40) * 0.55, // maintain 16:9 aspect ratio
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  tvImage: {
    width: "100%",
    height: "100%",
  },
  noStreamContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  noStreamText: {
    color: "#777",
    fontSize: 16,
  },
  liveBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF3B30",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  liveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  infoSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#AAAAAA",
    fontSize: 14,
    marginBottom: 12,
  },
  myChannelBtn: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.light.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  myChannelText: {
    color: "#0D0D0D",
    fontWeight: "700",
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 20,
    marginVertical: 10,
    marginTop: 20,
  },
  categoryBar: {
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 6,
    // paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 10,
  },
  categoryBadgeActive: {
    backgroundColor: COLORS.light.primary,
  },
  categoryBadgeText: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 12,
  },
  categoryBadgeTextActive: {
    color: "#0D0D0D",
    fontWeight: "700",
  },
  programCard: {
    width: 140,
    height: 180,
    // marginLeft: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    padding: 12,
    justifyContent: "space-between",
  },
  programTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  programDate: {
    color: "#AAAAAA",
    fontSize: 12,
  },
  podcastCard: {
    width: 140,
    height: 100,
    marginLeft: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  podcastText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width - 40,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#0D0D0D",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
  },
  addBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
    alignItems: "center",
  },
  addBtnText: {
    color: "#0D0D0D",
    fontWeight: "700",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  cancelBtn: {
    backgroundColor: "#777",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  cancelText: {
    color: "#fff",
    fontWeight: "700",
  },
  applyBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  applyText: {
    color: "#0D0D0D",
    fontWeight: "700",
  },
});

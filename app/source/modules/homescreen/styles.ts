import { StyleSheet } from "react-native";
// import { COLORS, Colors } from "../theme/colors";

import { Colors, COLORS } from "../../../core/theme/colors";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 10,
    // paddingTop: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 12,
    marginBlockStart: 22,
  },
  titleSimple: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    objectFit: "scale-down",
    padding: 10,
    // elevation: 0.1,
    marginRight: 10
  },
  username: {
    fontWeight: "bold",
    fontSize: 14
  },
  singleImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    objectFit: "cover",
    marginBottom: 8
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8
  },
  gridImage: {
    width: "48%",
    height: 150,
    borderRadius: 8,
    marginBottom: 6
  },
  postText: {
    fontSize: 14,
    color: "#333"
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8
  },
  seeMore: {
    fontSize: 13,
    color: "#007bff",
    marginTop: 4
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 8
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20
  },
  header1: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // marginBlockStart: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    // elevation: 1
  },
  titleSimple2: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.light.primary,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconRight: {
    marginRight: 16,
  },
  
  actionText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#555"
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    borderRadius: 10,
    height: 40,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.primaryDark,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  detailImage: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
    marginBottom: 10,
  },
  floatingIcons: {
    position: "absolute",
    right: 15,
    top: 200,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 5,
    alignItems: "center",
  },
  floatingBtn: {
    marginVertical: 10,
  },
  content: {
    padding: 15,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },


  tabContainer: {
    marginVertical: 10,
  },
  tabScroll: {
    paddingHorizontal: 10,
    flexDirection: "row",
  },
  tabButton: {
    marginRight: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.light.background,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#fff",
  },
  
  
  logo: {
    height: 40,
    width: 50,
    objectFit: "contain",
  },

  
  quoteCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  quoteUser: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  quoteText: {
    fontSize: 14,
    color: "#333",
  },
  twoImagesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  twoImage: {
    width: "48%",
    height: 150,
    borderRadius: 8,
    objectFit: "scale-down"
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    position: "relative"
  },
  moreOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "48%",
    height: 150,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center"
  },
  moreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff"
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  // Search and filter styles
  searchInputContainer: {
    position: 'relative',
  },
  searchInputWithTags: {
    paddingRight: 80, // Space for clear button
  },
  selectedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.light.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagBadgeText: {
    color: COLORS.light.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  tagBadgeRemove: {
    marginLeft: 6,
    padding: 2,
  },
  tagsFilterContainer: {
    marginBottom: 10,
  },
  tagsScroll: {
    paddingHorizontal: 10,
  },
  tagButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tagButtonSelected: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  tagButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tagButtonTextSelected: {
    color: '#fff',
  },
  clearSearchButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 4,
  },
});

export default styles;

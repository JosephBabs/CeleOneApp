import { StyleSheet } from 'react-native';
import { COLORS } from '../../../core/theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 54,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
  },
  stationMeta: {
    color: '#aaa',
    fontSize: 12,
  },
  stationTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  favText: {
    color: '#ccc',
    marginTop: 4,
  },
  castIcon: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: '#2d2d44',
    padding: 8,
    borderRadius: 20,
  },
  nowPlayingCard: {
    marginHorizontal: 24,
    marginTop: -20,
    backgroundColor: '#f6f6f6',
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  playingText: {
    flex: 1,
  },
  songTitle: {
    fontWeight: '600',
    fontSize: 14,
  },
  nowPlayingLabel: {
    color: '#888',
    fontSize: 12,
  },
  playButton: {
    backgroundColor: COLORS.light.primary,
    padding: 10,
    borderRadius: 20,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 24,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  hostName: {
    fontWeight: '600',
    fontSize: 14,
  },
  hostedBy: {
    fontSize: 12,
    color: '#888',
  },
  liveBadge: {
    backgroundColor: '#20c997',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
  },
  listeners: {
    fontSize: 12,
    color: '#888',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  sectionLink: {
    fontSize: 14,
    color: COLORS.light.primary,
  },
  card: {
    marginRight: 12,
    width: 120,
  },
  cardImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  cardTitle: {
    fontWeight: '600',
    marginTop: 6,
  },
  cardMeta: {
    color: '#888',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  gridImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  gridTitle: {
    fontWeight: '600',
    marginTop: 6,
  },
});

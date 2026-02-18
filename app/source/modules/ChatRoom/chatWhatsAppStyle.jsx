import { StyleSheet, Platform } from 'react-native';

export default StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    backgroundColor: '#fff',
    gap: 8,
  },
  hBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hAvatar: { width: 40, height: 40, borderRadius: 16, backgroundColor: '#EEE' },
  hTitle: { fontSize: 15.5, fontWeight: '900', color: '#111' },
  hSub: { marginTop: 2, fontSize: 12, fontWeight: '800', color: '#6B7280' },

  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    backgroundColor: '#fff',
    gap: 10,
  },
  selectBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectText: { flex: 1, fontSize: 13.5, fontWeight: '900', color: '#111' },

  bg: { flex: 1, backgroundColor: '#F8FAFC' },

  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 5, gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  rowSelected: { opacity: 0.82 },

  avatar: { width: 30, height: 30, borderRadius: 12, backgroundColor: '#EEE' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  bubbleMe: {
    backgroundColor: '#2FA5A9',
    borderColor: 'rgba(47,165,169,0.35)',
    borderTopRightRadius: 8,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
  },
  name: { fontSize: 12, fontWeight: '900', color: '#0F172A', marginBottom: 4 },

  msgText: { fontSize: 14.5, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  
  meta: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  time: { fontSize: 11.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },

  // override for other bubble time/text colors
  // easiest: use nested text with conditional in component if you want perfect WhatsApp match

  replyChip: {
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  replyName: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
  replyText: { marginTop: 2, fontSize: 12.5, fontWeight: '700', color: '#475569' },

  imageGrid: { gap: 8 },
  gridImg: { width: 220, height: 140, borderRadius: 14, backgroundColor: '#EEE' },

  fileBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileName: { flex: 1, fontSize: 13.5, fontWeight: '900', color: '#111' },

  audioBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audioWave: { flex: 1, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)' },
  audioTime: { fontSize: 12, fontWeight: '900', color: '#111' },

  typingBar: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typingAvatars: { flexDirection: 'row', alignItems: 'center' },
  typingAvatar: { width: 18, height: 18, borderRadius: 8, backgroundColor: '#EEE', borderWidth: 1, borderColor: '#fff' },
  typingText: { flex: 1, fontSize: 12.5, fontWeight: '900', color: '#111' },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2FA5A9', opacity: 0.7 },

  replyPreview: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
 
  inputBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 18,
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  input: { fontSize: 14.5, fontWeight: '700', color: '#111', maxHeight: 120 },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#2FA5A9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#2FA5A9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', padding: 12 },
  attachCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  attachText: { fontSize: 14, fontWeight: '900', color: '#111' },

chatBg: { flex: 1 },
chatBgImg: { opacity: 0.18, repeat: 'repeat', repeatX: true , width: '100%', height: '100%' },

connPill: {
  backgroundColor: '#FEF3C7',
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
connPillText: { color: '#92400E', fontWeight: '700', flex: 1 },

replyPreview: {
  marginHorizontal: 12,
  marginBottom: 8,
  backgroundColor: 'rgba(255,255,255,0.95)',
  borderRadius: 12,
  padding: 10,
  borderLeftWidth: 4,
  borderLeftColor: '#2FA5A9',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
replyPreviewTitle: { fontWeight: '900', color: '#0F172A', fontSize: 12 },
replyPreviewText: { color: '#334155', marginTop: 2, fontSize: 12 },
replyClose: { padding: 6 },

deletedText: { color: '#64748B', fontStyle: 'italic', fontWeight: '700' },

imageWrap: { marginTop: 6 },
oneImgBox: { borderRadius: 14, overflow: 'hidden', width: 240, height: 240 },
oneImg: { width: '100%', height: '100%' },

twoRow: { flexDirection: 'row', gap: 6 },
twoCell: { width: 120, height: 120, borderRadius: 14, overflow: 'hidden' },

threeRow: { flexDirection: 'row', gap: 6 },
threeLeft: { width: 140, height: 200, borderRadius: 14, overflow: 'hidden' },
threeRightCol: { gap: 6 },
threeRightCell: { width: 94, height: 97, borderRadius: 14, overflow: 'hidden' },

fourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 240 },
fourCell: { width: 117, height: 117, borderRadius: 14, overflow: 'hidden' },

gridImg: { width: '100%', height: '100%' },
moreOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.45)',
  alignItems: 'center',
  justifyContent: 'center',
},
moreText: { color: '#fff', fontWeight: '900', fontSize: 18 },

composerTop: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  paddingVertical: 10,
},
composerBottom: {
  padding: 12,
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 10,
},
composerCaption: {
  flex: 1,
  backgroundColor: '#0b1220',
  color: '#fff',
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 10,
  maxHeight: 120,
},
composerSend: {
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: '#2FA5A9',
  alignItems: 'center',
  justifyContent: 'center',
},

viewerTop: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  paddingVertical: 10,
},

  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  menuText: { fontSize: 14, fontWeight: '900', color: '#111' },
});

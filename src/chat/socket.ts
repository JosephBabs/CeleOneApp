// src/chat/socket.ts
import { io, Socket } from 'socket.io-client';
import {
  enqueueOutbox,
  getOutboxItems,
  removeOutbox,
  upsertMessage,
  markMessageStatus,
  markDeletedForAll,
  replaceTempId,

  // 👇 you must add these in localDb.ts (or keep as no-op)
  // markMessageEdited,
  // deleteLocalMessage,
} from './localDb';

export type MsgType = 'text' | 'image' | 'audio' | 'file';

type AuthProvider = {
  getUid: () => string | null;
  getToken: () => Promise<string>;
};

let authProvider: AuthProvider | null = null;
let socket: Socket | null = null;
let listenersAttached = false;

export function initSocketAuth(p: AuthProvider) {
  authProvider = p;
}

async function requireAuth() {
  if (!authProvider) throw new Error('SOCKET_AUTH_NOT_INITIALIZED');
  const uid = authProvider.getUid();
  if (!uid) throw new Error('NO_USER');
  const token = await authProvider.getToken();
  if (!token) throw new Error('NO_TOKEN');
  return { uid, token };
}

export async function connectSocketOnce(baseUrl: string) {
  if (socket && socket.connected) return socket;

  const { token } = await requireAuth();

  socket = io(baseUrl, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 10000,
  });

  // ✅ Refresh token before reconnect attempts
  socket.io.on('reconnect_attempt', async () => {
    try {
      const fresh = (await requireAuth()).token;
      if (socket) socket.auth = { token: fresh };
    } catch {}
  });

  // ✅ Also refresh token on connect_error (important for AUTH_FAILED)
  socket.on('connect_error', async () => {
    try {
      const fresh = (await requireAuth()).token;
      if (socket) socket.auth = { token: fresh };
    } catch {}
  });

  return socket;
}

export function getSocketOrNull() {
  return socket;
}

export function getSocket() {
  if (!socket) throw new Error('SOCKET_NOT_CONNECTED');
  return socket;
}

/**
 * Attach listeners ONCE (global)
 * These listeners update SQLite so UI can refresh from localDb.
 */
export function attachGlobalChatListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const s = getSocket();

  // ✅ ACK for send
  s.on('msg:ack', async ({ chatId, clientId, messageId, status, error }) => {
    try {
      if (status === 'sent' && messageId) {
        await removeOutbox(clientId);
        await replaceTempId(clientId, messageId); // tempId -> realId
        await markMessageStatus(messageId, 'sent');
      } else if (status === 'failed') {
        // failed temp message stays as temp id
        await markMessageStatus(clientId, 'failed');
        console.log('[socket] send failed:', error);
      }
    } catch (e) {
      console.log('[socket] ack handler error:', e);
    }
  });

  // ✅ New message
  s.on('msg:new', async ({ chatId, messageId, msg }) => {
    try {
      await upsertMessage({
        id: messageId,
        chatId,
        clientId: msg.clientId,
        fromUid: msg.from?.uid,
        fromName: msg.from?.name || 'User',
        fromAvatar: msg.from?.avatar || '',
        type: msg.type,
        text: msg.text,
        caption: msg.caption,
        media: msg.media || [],
        replyToId: msg.replyToId,
        replyToSnapshot: msg.replyToSnapshot,
        createdAt: msg.createdAtMs || Date.now(),
        status: 'sent',
        deletedForAll: msg.deletedForAll ? 1 : 0,
        // optional fields if you add them:
        // editedAt: msg.editedAtMs || null,
        // isEdited: msg.isEdited ? 1 : 0,
      });

      // delivered receipt for messages not mine
      const myUid = authProvider?.getUid?.() || null;
      if (msg?.from?.uid && myUid && msg.from.uid !== myUid) {
        s.emit('msg:delivered', { chatId, messageId });
      }
    } catch (e) {
      console.log('[socket] msg:new handler error:', e);
    }
  });

  // ✅ Receipts
  s.on('msg:receipt', async ({ messageId, kind }) => {
    try {
      if (kind === 'delivered') await markMessageStatus(messageId, 'delivered');
      if (kind === 'read') await markMessageStatus(messageId, 'read');
    } catch {}
  });

  // ✅ Delete-for-all broadcast
  s.on('msg:deleted', async ({ messageId }) => {
    try {
      // IMPORTANT: if user already deleted-for-me (hidden),
      // do NOT turn it into "Message deleted" placeholder.
      const wasHidden = await isMessageHidden?.(messageId); // implement in localDb
      if (wasHidden) return;

      await markDeletedForAll(messageId);
    } catch {
      // ignore
    }
  });

  // ✅ Edit broadcast (must update existing row, NOT create new)
  // Server should emit: { chatId, messageId, patch: { text, caption, ... }, editedAtMs }
  s.on('msg:edited', async ({ chatId, messageId, patch, editedAtMs }) => {
    try {
      // Update the SAME message row (upsertMessage must merge by id)
      await upsertMessage({
        id: messageId,
        chatId,
        ...patch, // e.g. { text: "new", caption: null }
        // optional flags if your schema supports:
        // isEdited: 1,
        // editedAt: editedAtMs || Date.now(),
      } as any);
    } catch (e) {
      console.log('[socket] msg:edited handler error:', e);
    }
  });

  // Join feedback (optional)
  s.on('chat:joined', p => console.log('[socket] joined', p));
  s.on('error:join', p => console.log('[socket] join error', p));

  // Delete feedback (optional)
  s.on('msg:deleteForAll:ack', p =>
    console.log('[socket] deleteForAll ack', p),
  );
  s.on('error:deleteForAll', p =>
    console.log('[socket] deleteForAll error', p),
  );

  // Edit feedback (optional)
  s.on('msg:edit:ack', p => console.log('[socket] edit ack', p));
  s.on('error:edit', p => console.log('[socket] edit error', p));
}

export async function joinChat(chatId: string) {
  const s = getSocket();
  s.emit('chat:join', { chatId });
}

export async function flushOutbox(chatId: string) {
  const s = getSocket();
  const items = await getOutboxItems(chatId);

  for (const it of items) {
    s.emit('msg:send', { chatId, clientId: it.clientId, payload: it.payload });
  }
}

/**
 * Send message: always enqueue locally first (offline safe),
 * then emit if connected.
 */
export async function sendMessage(
  chatId: string,
  clientId: string,
  payload: any,
) {
  await enqueueOutbox(chatId, clientId, payload);

  await upsertMessage({
    id: clientId, // temp id
    chatId,
    clientId,
    fromUid: payload.from?.uid,
    fromName: payload.from?.name,
    fromAvatar: payload.from?.avatar,
    type: payload.type,
    text: payload.text || null,
    caption: payload.caption || null,
    media: payload.media || [],
    replyToId: payload.replyToId || null,
    replyToSnapshot: payload.replyToSnapshot || null,
    createdAt: Date.now(),
    status: 'pending',
    deletedForAll: 0,
    // optional:
    // isEdited: 0,
    // editedAt: null,
  });

  if (socket && socket.connected) {
    socket.emit('msg:send', { chatId, clientId, payload });
  }
}

export function emitTyping(
  chatId: string,
  typing: boolean,
  me?: { name?: string; avatar?: string },
) {
  if (!socket || !socket.connected) return;
  if (typing)
    socket.emit('typing:start', { chatId, name: me?.name, avatar: me?.avatar });
  else socket.emit('typing:stop', { chatId });
}

/**
 * ✅ Delete for everyone
 * - optimistic local mark
 * - server will broadcast msg:deleted for everyone
 */
export async function deleteForAll(chatId: string, messageId: string) {
  if (!socket) return;

  // optimistic local UI
  try {
    await markDeletedForAll(messageId);
  } catch {}

  socket.emit('msg:deleteForAll', { chatId, messageId });
}

/**
 * ✅ Delete for me (local only)
 * WhatsApp behavior: remove from my device only.
 * Requires you to add deleteLocalMessage(messageId) in localDb.
 */
export async function deleteForMe(messageId: string) {
  // Local only: hide it (WhatsApp behavior)
  await hideMessage(messageId); // implement in localDb
}

/**
 * ✅ Edit message
 * - updates the same message row (NOT a new message)
 * - optimistic local patch
 * - server broadcasts msg:edited
 *
 * patch can be:
 * { text: "...", caption: null }
 */
export async function editMessage(
  chatId: string,
  messageId: string,
  patch: { text?: string | null; caption?: string | null },
) {
  if (!socket) return;

  // optimistic local update (same id)
  try {
    await upsertMessage({
      id: messageId,
      chatId,
      ...patch,
      // optional flags:
      // isEdited: 1,
      // editedAt: Date.now(),
    } as any);
  } catch {}

  socket.emit('msg:edit', { chatId, messageId, patch });
}

/**
 * ✅ Mark read (call from UI when message becomes visible)
 */
export function markRead(chatId: string, messageId: string) {
  if (!socket || !socket.connected) return;
  socket.emit('msg:read', { chatId, messageId });
}

export function blockUser(chatId: string, targetUid: string) {
  if (!socket) return;
  socket.emit('room:block', { chatId, targetUid });
}

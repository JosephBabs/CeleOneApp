// server/index.js
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

admin.initializeApp({
  credential: admin.credential.applicationDefault(), // OR service account
});
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

// --- Auth middleware: verify Firebase ID token ---
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("NO_TOKEN"));

    const decoded = await admin.auth().verifyIdToken(token);
    socket.user = { uid: decoded.uid };
    next();
  } catch (e) {
    next(new Error("AUTH_FAILED"));
  }
});

// --- helpers ---
const roomKey = (chatId) => `chat:${chatId}`;

async function ensureMember(chatId, uid) {
  const roomDoc = await db.collection("chatrooms").doc(chatId).get();
  if (!roomDoc.exists) throw new Error("ROOM_NOT_FOUND");

  const room = roomDoc.data();
  const members = room.members || [];
  const blocked = room.blockedUsers || [];

  if (!members.includes(uid)) throw new Error("NOT_MEMBER");
  if (blocked.includes(uid)) throw new Error("BLOCKED");
  if (room.isClosed) throw new Error("ROOM_CLOSED");

  return room;
}

io.on("connection", (socket) => {
  const uid = socket.user.uid;

  socket.on("chat:join", async ({ chatId }) => {
    try {
      await ensureMember(chatId, uid);
      socket.join(roomKey(chatId));
      socket.emit("chat:joined", { chatId });

      socket.to(roomKey(chatId)).emit("presence:update", { chatId, uid, online: true });
    } catch (e) {
      socket.emit("error:join", { chatId, message: e.message });
    }
  });

  socket.on("chat:leave", ({ chatId }) => {
    socket.leave(roomKey(chatId));
    socket.to(roomKey(chatId)).emit("presence:update", { chatId, uid, online: false });
  });

  socket.on("typing:start", ({ chatId, name, avatar }) => {
    socket.to(roomKey(chatId)).emit("typing:update", {
      chatId,
      uid,
      typing: true,
      name: name || null,
      avatar: avatar || null,
    });
  });

  socket.on("typing:stop", ({ chatId }) => {
    socket.to(roomKey(chatId)).emit("typing:update", { chatId, uid, typing: false });
  });

  // Send message (idempotent by clientId)
  socket.on("msg:send", async ({ chatId, clientId, payload }) => {
    try {
      const room = await ensureMember(chatId, uid);

      const ref = db.collection("chatrooms").doc(chatId).collection("messages");

      const existing = await ref.where("clientId", "==", clientId).limit(1).get();
      if (!existing.empty) {
        const docId = existing.docs[0].id;
        socket.emit("msg:ack", { chatId, clientId, messageId: docId, status: "sent" });
        return;
      }

      const messageId = uuidv4();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const nowMs = Date.now();

      // IMPORTANT: do not trust payload.from.uid
      const safeFrom = {
        ...(payload.from || {}),
        uid,
      };

      const msg = {
        clientId,
        type: payload.type,
        text: payload.text || null,
        caption: payload.caption || null,
        media: payload.media || [],
        replyToId: payload.replyToId || null,
        replyToSnapshot: payload.replyToSnapshot || null,
        from: safeFrom,
        createdAt: now,
        createdAtMs: nowMs,
        deletedForAll: false,
        deletedAt: null,
        deliveredTo: {},
        readBy: {},
      };

      await ref.doc(messageId).set(msg);
      await db.collection("chatrooms").doc(chatId).update({ updatedAt: now });

      socket.emit("msg:ack", { chatId, clientId, messageId, status: "sent" });

      io.to(roomKey(chatId)).emit("msg:new", { chatId, messageId, msg });

      // (optional) could also notify offline via FCM using your userTokens collection
      // if you want, tell me and I'll wire it.
      void room;
    } catch (e) {
      socket.emit("msg:ack", { chatId, clientId, status: "failed", error: e.message });
    }
  });

  socket.on("msg:delivered", async ({ chatId, messageId }) => {
    try {
      await ensureMember(chatId, uid);
      const msgRef = db.collection("chatrooms").doc(chatId).collection("messages").doc(messageId);
      await msgRef.set({ deliveredTo: { [uid]: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true });
      io.to(roomKey(chatId)).emit("msg:receipt", { chatId, messageId, kind: "delivered", uid });
    } catch {}
  });

  socket.on("msg:read", async ({ chatId, messageId }) => {
    try {
      await ensureMember(chatId, uid);
      const msgRef = db.collection("chatrooms").doc(chatId).collection("messages").doc(messageId);
      await msgRef.set({ readBy: { [uid]: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true });
      io.to(roomKey(chatId)).emit("msg:receipt", { chatId, messageId, kind: "read", uid });
    } catch {}
  });

  socket.on("msg:deleteForAll", async ({ chatId, messageId }) => {
    try {
      const roomDoc = await db.collection("chatrooms").doc(chatId).get();
      if (!roomDoc.exists) throw new Error("ROOM_NOT_FOUND");
      const room = roomDoc.data();

      const msgRef = db.collection("chatrooms").doc(chatId).collection("messages").doc(messageId);
      const msgDoc = await msgRef.get();
      if (!msgDoc.exists) throw new Error("MSG_NOT_FOUND");
      const msg = msgDoc.data();

      const isAdmin = (room.admins || []).includes(uid);
      const isSender = msg?.from?.uid === uid;
      if (!isAdmin && !isSender) throw new Error("NO_PERMISSION");

      await msgRef.update({
        deletedForAll: true,
        text: null,
        caption: null,
        media: [],
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      io.to(roomKey(chatId)).emit("msg:deleted", { chatId, messageId });
    } catch (e) {
      socket.emit("error:deleteForAll", { chatId, messageId, message: e.message });
    }
  });

  socket.on("room:block", async ({ chatId, targetUid }) => {
    try {
      const roomRef = db.collection("chatrooms").doc(chatId);
      const roomDoc = await roomRef.get();
      const room = roomDoc.data();

      if (!(room.admins || []).includes(uid)) throw new Error("ONLY_ADMIN");

      await roomRef.update({
        blockedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
      });

      io.to(roomKey(chatId)).emit("room:blocked", { chatId, targetUid });
    } catch (e) {
      socket.emit("error:block", { chatId, message: e.message });
    }
  });
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("socket server on", PORT));

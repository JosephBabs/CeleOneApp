import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * 🔔 Chat message notification
 */
export const onNewChatMessage = functions.firestore
  .document("chatrooms/{roomId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { roomId } = context.params;

    if (!message) return;

    const senderId = message.senderId;
    const text = message.text || "New message";

    // Get chatroom
    const roomSnap = await db.collection("chatrooms").doc(roomId).get();
    if (!roomSnap.exists) return;

    const room = roomSnap.data();
    const members: string[] = room?.members || [];

    // Exclude sender
    const targetUserIds = members.filter(uid => uid !== senderId);

    if (targetUserIds.length === 0) return;

    // Fetch FCM tokens
    const userDocs = await Promise.all(
      targetUserIds.map(uid => db.collection("users").doc(uid).get())
    );

    const tokens = userDocs
      .map(doc => doc.data()?.fcmToken)
      .filter(Boolean);

    if (tokens.length === 0) return;

    // Send notification
    await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title: room?.name || "New Message",
        body: text,
      },
      data: {
        type: "chat",
        roomId,
      },
    });
  });

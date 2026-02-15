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



  // functions/index.js (Node 18+)
// const functions = require('firebase-functions/v2');
// const admin = require('firebase-admin');
admin.initializeApp();

// Use Google Cloud Translation API
// npm i @google-cloud/translate
const { TranslationServiceClient } = require('@google-cloud/translate');
const translateClient = new TranslationServiceClient();

exports.translatePostRequest = functions.firestore.onDocumentCreated(
  'posts/{postId}/translation_requests/{lang}',
  async (event) => {
    const { postId, lang } = event.params;
    const reqData = event.data.data();

    const targetLang = reqData.targetLang || lang;
    const sourceLang = reqData.sourceLang || 'auto';
    const text = reqData.text || '';

    if (!text) return;

    const projectId = process.env.GCLOUD_PROJECT;
    const location = 'global';

    const [response] = await translateClient.translateText({
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: sourceLang === 'auto' ? undefined : sourceLang,
      targetLanguageCode: targetLang,
    });

    const translated = response.translations?.[0]?.translatedText || '';

    // write cache back to post
    await admin.firestore().doc(`posts/${postId}`).set(
      {
        translations: { [targetLang]: translated },
        // (optional) keep originalLang if missing
        originalLang: reqData.sourceLang || admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    // optionally delete request doc
    await admin.firestore().doc(`posts/${postId}/translation_requests/${lang}`).delete();
  }
);

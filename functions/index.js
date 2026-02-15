const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Google Translate (Cloud)
const { TranslationServiceClient } = require('@google-cloud/translate');
const client = new TranslationServiceClient();

exports.translateText = functions.https.onCall(async (data, context) => {
  const { text, targetLang, sourceLang } = data;
  if (!text || !targetLang) throw new functions.https.HttpsError('invalid-argument', 'Missing params');

  const projectId = process.env.GCLOUD_PROJECT;
  const location = 'global';

  const [res] = await client.translateText({
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: 'text/plain',
    sourceLanguageCode: sourceLang || undefined,
    targetLanguageCode: targetLang,
  });

  return { translated: res.translations?.[0]?.translatedText || '' };
});

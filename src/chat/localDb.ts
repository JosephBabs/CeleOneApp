// src/chat/localDb.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

function mustDb() {
  if (!db) throw new Error('DB_NOT_INITIALIZED: call initChatDb() first');
  return db;
}

  async function ensureColumn(table: string, column: string, ddl: string) {
    const d = mustDb();
    const [res] = await d.executeSql(`PRAGMA table_info(${table});`);
    const cols: string[] = [];
    for (let i = 0; i < res.rows.length; i++) cols.push(res.rows.item(i).name);
    if (!cols.includes(column)) {
      await d.executeSql(ddl);
    }
  }
export async function initChatDb() {
  if (db) return db;

  db = await SQLite.openDatabase({
    name: 'celeone_chat.db',
    location: 'default',
  });

  // Messages (id = messageId from server OR temp clientId before ack)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      clientId TEXT,
      fromUid TEXT,
      fromName TEXT,
      fromAvatar TEXT,
      type TEXT,
      text TEXT,
      caption TEXT,
      mediaJson TEXT,
      replyToId TEXT,
      replyToSnapshotJson TEXT,
      createdAt INTEGER,
      status TEXT,
      deletedForAll INTEGER
    );

  `);

  await ensureColumn("messages", "hidden", `ALTER TABLE messages ADD COLUMN hidden INTEGER DEFAULT 0`);
await ensureColumn("messages", "isEdited", `ALTER TABLE messages ADD COLUMN isEdited INTEGER DEFAULT 0`);
await ensureColumn("messages", "editedAt", `ALTER TABLE messages ADD COLUMN editedAt INTEGER`);



  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chatId, createdAt);
  `);

  // Outbox queue
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS outbox (
      clientId TEXT PRIMARY KEY,
      chatId TEXT,
      payloadJson TEXT,
      createdAt INTEGER,
      tries INTEGER,
      lastError TEXT
    );
  `);

  return db;
}

export async function upsertMessage(row: any) {
  const d = mustDb();
  const sql = `
    INSERT OR REPLACE INTO messages (
      id, chatId, clientId, fromUid, fromName, fromAvatar, type, text, caption,
      mediaJson, replyToId, replyToSnapshotJson, createdAt, status, deletedForAll
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const args = [
    row.id,
    row.chatId,
    row.clientId || null,
    row.fromUid || '',
    row.fromName || '',
    row.fromAvatar || '',
    row.type || 'text',
    row.text ?? null,
    row.caption ?? null,
    JSON.stringify(row.media || []),
    row.replyToId ?? null,
    JSON.stringify(row.replyToSnapshot ?? null),
    row.createdAt ?? Date.now(),
    row.status || 'sent',
    row.deletedForAll ? 1 : 0,
  ];

  await d.executeSql(sql, args);
}

export async function listMessages(chatId: string, limit = 300) {
  const d = mustDb();
  const [res] = await d.executeSql(
    `SELECT * FROM messages WHERE chatId=? ORDER BY createdAt ASC LIMIT ?`,
    [chatId, limit],
  );

  const rows: any[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    const r = res.rows.item(i);
    rows.push({
      ...r,
      media: JSON.parse(r.mediaJson || '[]'),
      replyToSnapshot: JSON.parse(r.replyToSnapshotJson || 'null'),
      deletedForAll: !!r.deletedForAll,
    });
  }
  return rows;
}

export async function enqueueOutbox(
  chatId: string,
  clientId: string,
  payload: any,
) {
  const d = mustDb();
  await d.executeSql(
    `INSERT OR REPLACE INTO outbox(clientId, chatId, payloadJson, createdAt, tries, lastError)
     VALUES(?, ?, ?, ?, COALESCE((SELECT tries FROM outbox WHERE clientId=?),0), NULL)`,
    [clientId, chatId, JSON.stringify(payload), Date.now(), clientId],
  );
}

export async function removeOutbox(clientId: string) {
  const d = mustDb();
  await d.executeSql(`DELETE FROM outbox WHERE clientId=?`, [clientId]);
}

export async function getOutboxItems(chatId: string) {
  const d = mustDb();
  const [res] = await d.executeSql(
    `SELECT * FROM outbox WHERE chatId=? ORDER BY createdAt ASC`,
    [chatId],
  );

  const rows: any[] = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));

  return rows.map(r => ({ ...r, payload: JSON.parse(r.payloadJson) }));
}

export async function markMessageStatus(messageId: string, status: string) {
  const d = mustDb();
  await d.executeSql(`UPDATE messages SET status=? WHERE id=?`, [
    status,
    messageId,
  ]);
}

export async function markDeletedForAll(messageId: string) {
  const d = mustDb();
  await d.executeSql(
    `UPDATE messages 
     SET deletedForAll=1, text=NULL, caption=NULL, mediaJson='[]'
     WHERE id=?`,
    [messageId],
  );
}

/**
 * IMPORTANT:
 * When you send a message, you store it locally as id=clientId (temp).
 * When server ACK returns real messageId, replace id so receipts/deletes work.
 */
export async function replaceTempId(clientId: string, messageId: string) {
  const d = mustDb();
  await d.executeSql(`UPDATE messages SET id=?, status='sent' WHERE id=?`, [
    messageId,
    clientId,
  ]);
}

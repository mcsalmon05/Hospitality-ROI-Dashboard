const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Cloud Persistence Bridge ---
// Fallback to local files if no Firebase config found (Hybrid Mode)
let isCloud = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!admin.apps.length) {
      const b64 = process.env.FIREBASE_SERVICE_ACCOUNT;
      // Handle potential Base64 encoding if needed, or just JSON
      const config = b64.startsWith('{') ? b64 : Buffer.from(b64, 'base64').toString();
      const serviceAccount = JSON.parse(config);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    isCloud = true;
    console.log('✅ Google Firestore: Connected (Live Cloud Persistence)');
  } else {
    console.warn('⚠️ Google Firestore: Config missing. Falling back to Local Persistence.');
  }
} catch (err) {
  console.error('❌ Google Firestore: Error initialization:', err.message);
  isCloud = false; // Force fallback
}

const db = isCloud ? admin.firestore() : null;

// Helper: Collection References
const collections = {
  accounts: 'hospitality_properties',
  news: 'daily_intelligence',
  tickets: 'triage_queue',
  recaps: 'daily_briefings',
  users: 'dashboard_users'
};

const getCollection = (key) => {
  if (!db) return null;
  return db.collection(collections[key]);
};

// --- Unified Data Access Logic ---
const readAll = async (key, localPath) => {
  try {
    if (isCloud && db) {
      const coll = getCollection(key);
      if (coll) {
        const snapshot = await coll.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } catch (e) {
    console.warn(`[DB] Fallback for ${key}:`, e.message);
    try { return JSON.parse(fs.readFileSync(localPath, 'utf8')); } catch(e2) { return []; }
  }
};

const writeOne = async (key, id, data) => {
  try {
    if (isCloud && db) {
      const coll = getCollection(key);
      if (coll) {
        await coll.doc(id).set(data, { merge: true });
        return;
      }
    }
    console.log(`[Local Write] Persisting ${id} to ${key}`);
  } catch (e) {
    console.error(`[DB] Write failure for ${key}:`, e.message);
  }
};

module.exports = { isCloud, db, readAll, writeOne };

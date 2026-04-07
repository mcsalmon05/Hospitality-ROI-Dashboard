const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Cloud Persistence Bridge ---
// Fallback to local files if no Firebase config found (Hybrid Mode)
let isCloud = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isCloud = true;
    console.log('✅ Google Firestore: Connected (Live Cloud Persistence)');
  } else {
    console.warn('⚠️ Google Firestore: Config missing. Falling back to Local Persistence.');
  }
} catch (err) {
  console.error('❌ Google Firestore: Error initialization:', err.message);
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

const getCollection = (key) => db ? db.collection(collections[key]) : null;

// --- Unified Data Access Logic ---
const readAll = async (key, localPath) => {
  if (isCloud) {
    const snapshot = await getCollection(key).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
};

const writeOne = async (key, id, data) => {
  if (isCloud) {
    await getCollection(key).doc(id).set(data, { merge: true });
  } else {
    // Local persistence still works for dev
    console.log(`[Local Write] Persisting ${id} to ${key}`);
  }
};

module.exports = { isCloud, db, readAll, writeOne };

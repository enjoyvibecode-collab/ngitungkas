import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Optimize Firestore for browser environments
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true // Forced long polling usually fixes "unavailable" in proxy environments
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("✅ Firestore connected successfully.");
  } catch (error) {
    if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.warn("⚠️ Firestore is in offline mode. Changes will sync once connection is restored.");
    } else if (error.code !== 'permission-denied' && error.code !== 'not-found') {
      console.error("❌ Firestore Connection Error:", error);
    }
  }
}

testConnection();

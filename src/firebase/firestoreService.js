// Firestore Service - Database operations
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// ────────────────────────────────────────────────────────────
// WORDS CRUD
// ────────────────────────────────────────────────────────────

/**
 * Save/Update a single word
 */
export const saveWord = async (userId, word) => {
  try {
    const wordRef = doc(db, 'users', userId, 'words', word.id);
    await setDoc(wordRef, {
      ...word,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving word:', error);
    return { success: false, error };
  }
};

/**
 * Batch save multiple words
 */
export const saveWords = async (userId, words) => {
  try {
    const promises = words.map(word => saveWord(userId, word));
    await Promise.all(promises);
    return { success: true };
  } catch (error) {
    console.error('Error batch saving words:', error);
    return { success: false, error };
  }
};

/**
 * Delete a word
 */
export const deleteWord = async (userId, wordId) => {
  try {
    await deleteDoc(doc(db, 'users', userId, 'words', wordId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting word:', error);
    return { success: false, error };
  }
};

/**
 * Get all words (one-time read)
 */
export const getWords = async (userId) => {
  try {
    const wordsRef = collection(db, 'users', userId, 'words');
    const snapshot = await getDocs(wordsRef);
    const words = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: words };
  } catch (error) {
    console.error('Error getting words:', error);
    return { success: false, error, data: [] };
  }
};

/**
 * Subscribe to words (realtime updates)
 */
export const subscribeToWords = (userId, callback) => {
  const wordsRef = collection(db, 'users', userId, 'words');
  const q = query(wordsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const words = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(words);
  }, (error) => {
    console.error('Error subscribing to words:', error);
    callback([]);
  });
};

// ────────────────────────────────────────────────────────────
// STATS CRUD
// ────────────────────────────────────────────────────────────

/**
 * Save user stats
 */
export const saveStats = async (userId, stats) => {
  try {
    const statsRef = doc(db, 'users', userId, 'data', 'stats');
    await setDoc(statsRef, {
      ...stats,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving stats:', error);
    return { success: false, error };
  }
};

/**
 * Get user stats
 */
export const getStats = async (userId) => {
  try {
    const statsRef = doc(db, 'users', userId, 'data', 'stats');
    const snapshot = await getDoc(statsRef);

    if (snapshot.exists()) {
      return { success: true, data: snapshot.data() };
    } else {
      return { success: true, data: {} };
    }
  } catch (error) {
    console.error('Error getting stats:', error);
    return { success: false, error, data: {} };
  }
};

/**
 * Subscribe to stats (realtime)
 */
export const subscribeToStats = (userId, callback) => {
  const statsRef = doc(db, 'users', userId, 'data', 'stats');

  return onSnapshot(statsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback({});
    }
  }, (error) => {
    console.error('Error subscribing to stats:', error);
    callback({});
  });
};

// ────────────────────────────────────────────────────────────
// MIGRATION HELPERS
// ────────────────────────────────────────────────────────────

/**
 * Migrate localStorage data to Firestore
 */
export const migrateLocalStorageToFirestore = async (userId) => {
  try {
    // Get data from localStorage
    const localWords = JSON.parse(localStorage.getItem('vm_words') || '[]');
    const localStats = JSON.parse(localStorage.getItem('vm_stats') || '{}');

    if (localWords.length > 0) {
      console.log(`Migrating ${localWords.length} words to Firestore...`);
      await saveWords(userId, localWords);
    }

    if (Object.keys(localStats).length > 0) {
      console.log('Migrating stats to Firestore...');
      await saveStats(userId, localStats);
    }

    return { success: true, migratedWords: localWords.length };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
};

/**
 * Delete ALL user data from Firestore (words + stats)
 */
export const deleteAllUserData = async (userId) => {
  try {
    console.log('🗑️ Deleting all user data from Firestore...');

    // Get all words
    const wordsRef = collection(db, 'users', userId, 'words');
    const snapshot = await getDocs(wordsRef);

    // Delete all words
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete stats
    const statsRef = doc(db, 'users', userId, 'data', 'stats');
    await deleteDoc(statsRef);

    console.log(`✅ Deleted ${snapshot.docs.length} words and stats`);
    return { success: true, deletedCount: snapshot.docs.length };
  } catch (error) {
    console.error('Error deleting user data:', error);
    return { success: false, error };
  }
};

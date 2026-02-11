// Firestore Service - Database operations
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch
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
 * Batch save multiple words (OPTIMIZED - uses writeBatch)
 * Firestore limit: 500 operations per batch
 */
export const saveWords = async (userId, words) => {
  try {
    console.log(`📦 Batch saving ${words.length} words...`);

    // Split into chunks of 500 (Firestore batch limit)
    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize));
    }

    // Process each chunk with writeBatch
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batch = writeBatch(db);

      chunk.forEach(word => {
        const wordRef = doc(db, 'users', userId, 'words', word.id);
        batch.set(wordRef, {
          ...word,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      console.log(`✅ Batch ${i + 1}/${chunks.length} saved (${chunk.length} words)`);
    }

    console.log(`✅ All ${words.length} words saved successfully`);
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

  // Don't use orderBy('updatedAt') - it EXCLUDES documents without updatedAt field
  return onSnapshot(wordsRef, (snapshot) => {
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
// TOEIC VOCABULARY IMPORT
// ────────────────────────────────────────────────────────────

/**
 * Import TOEIC vocabulary lessons to user's collection
 * @param {string} userId - User ID
 * @param {Array} toeicWords - Array of TOEIC words from getAllTOEICWords()
 * @param {Array} lessonIds - Optional: array of lesson IDs to import (e.g. ['lesson-1', 'lesson-2'])
 *                            If not provided, imports all lessons
 */
export const importTOEICWords = async (userId, toeicWords, lessonIds = null) => {
  try {
    // Filter by lesson IDs if provided
    let wordsToImport = toeicWords;
    if (lessonIds && lessonIds.length > 0) {
      wordsToImport = toeicWords.filter(word => lessonIds.includes(word.lesson));
    }

    console.log(`📚 Importing ${wordsToImport.length} TOEIC words...`);

    // Check which words already exist
    const existingWordsResult = await getWords(userId);
    const existingWordIds = new Set(
      existingWordsResult.data.map(w => w.id)
    );

    // Only import words that don't exist yet
    const newWords = wordsToImport.filter(word => !existingWordIds.has(word.id));

    if (newWords.length === 0) {
      console.log('✅ All TOEIC words already imported');
      return { success: true, imported: 0, skipped: wordsToImport.length };
    }

    // Use batch save
    await saveWords(userId, newWords);

    console.log(`✅ Imported ${newWords.length} new TOEIC words (${wordsToImport.length - newWords.length} already existed)`);
    return {
      success: true,
      imported: newWords.length,
      skipped: wordsToImport.length - newWords.length
    };
  } catch (error) {
    console.error('Error importing TOEIC words:', error);
    return { success: false, error, imported: 0, skipped: 0 };
  }
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

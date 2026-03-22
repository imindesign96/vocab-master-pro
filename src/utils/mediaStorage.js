/**
 * IndexedDB storage for card media (audio + images).
 * Firestore has a 1MB/document limit — audio files can be 600KB each,
 * so we keep media local and only sync text to Firestore.
 *
 * Schema: DB "flashanki_media", store "media", key = Firestore card ID
 * Value: { audioWord?, audioExA?, audioExB?, imageData? }  (base64 data URLs)
 */

const DB_NAME  = 'flashanki_media';
const DB_VER   = 1;
const STORE    = 'media';

let _dbPromise = null;

function openDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      req.onsuccess  = e => resolve(e.target.result);
      req.onerror    = e => { _dbPromise = null; reject(e.target.error); };
    });
  }
  return _dbPromise;
}

/**
 * Store media for many cards in one transaction (fast).
 * entries: Array<{ id: string, audioWord?, audioExA?, audioExB?, imageData? }>
 */
export async function storeMediaBatch(entries) {
  const relevant = entries.filter(
    e => e.audioWord || e.audioExA || e.audioExB || e.imageData
  );
  if (relevant.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const e of relevant) {
      const obj = {};
      if (e.audioWord)  obj.audioWord  = e.audioWord;
      if (e.audioExA)   obj.audioExA   = e.audioExA;
      if (e.audioExB)   obj.audioExB   = e.audioExB;
      if (e.imageData)  obj.imageData  = e.imageData;
      store.put(obj, e.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror    = e  => reject(e.target.error);
  });
}

/**
 * Get media for a single card. Returns {} if none stored.
 */
export async function getMedia(cardId) {
  if (!cardId) return {};
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(cardId);
      req.onsuccess = e => resolve(e.target.result || {});
      req.onerror   = e => reject(e.target.error);
    });
  } catch {
    return {};
  }
}

/**
 * Delete media for a list of card IDs (called when deleting a deck).
 */
export async function deleteMediaBatch(cardIds) {
  if (!cardIds?.length) return;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const id of cardIds) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = e  => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[mediaStorage] deleteMediaBatch error:', e);
  }
}

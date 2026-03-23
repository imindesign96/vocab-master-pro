/**
 * Firestore service for Anki-style deck/card data
 * Schema:
 *   users/{uid}/decks/{deckId}  — deck metadata
 *   users/{uid}/cards/{cardId}  — individual cards with SRS data
 */
import {
  collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { createCard } from '../utils/srsEngine';
import { storeMediaBatch, deleteMediaBatch } from '../utils/mediaStorage';

// ── Decks ─────────────────────────────────────────────

export async function getDecks(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'decks'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createDeck(uid, name) {
  const ref = await addDoc(collection(db, 'users', uid, 'decks'), {
    name,
    createdAt: serverTimestamp(),
    cardCount: 0,
  });
  return ref.id;
}

export async function deleteDeck(uid, deckId) {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'cards'), where('deckId', '==', deckId))
  );

  const refs    = snap.docs.map(d => d.ref);
  const cardIds = snap.docs.map(d => d.id);

  // Delete Firestore docs in parallel groups of 30
  const GROUP = 30;
  for (let i = 0; i < refs.length; i += GROUP) {
    await Promise.all(refs.slice(i, i + GROUP).map(ref => deleteDoc(ref)));
  }

  // Delete media from IndexedDB
  await deleteMediaBatch(cardIds);

  await deleteDoc(doc(db, 'users', uid, 'decks', deckId));
}

export async function updateDeckCount(uid, deckId, delta) {
  const ref = doc(db, 'users', uid, 'decks', deckId);
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'cards'), where('deckId', '==', deckId))
  );
  await updateDoc(ref, { cardCount: snap.size });
}

// ── Cards ─────────────────────────────────────────────

export async function getCards(uid, deckId = null) {
  let q;
  if (deckId) {
    q = query(collection(db, 'users', uid, 'cards'), where('deckId', '==', deckId));
  } else {
    q = collection(db, 'users', uid, 'cards');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCard(uid, deckId, { front, back, example = '', tags = [] }) {
  const card = {
    deckId,
    front,
    back,
    example,
    tags,
    createdAt: serverTimestamp(),
    ...createCard(),
  };
  const ref = await addDoc(collection(db, 'users', uid, 'cards'), card);
  await updateDeckCount(uid, deckId);
  return ref.id;
}

export async function updateCard(uid, cardId, updates) {
  await updateDoc(doc(db, 'users', uid, 'cards', cardId), updates);
}

export async function deleteCard(uid, cardId, deckId) {
  await deleteDoc(doc(db, 'users', uid, 'cards', cardId));
  if (deckId) await updateDeckCount(uid, deckId);
}

/**
 * Batch import cards into a deck.
 * TEXT + audioWord → Firestore (syncs across devices; word audio ~50KB fits fine)
 * audioExA/audioExB/imageData → IndexedDB only (too large for Firestore)
 *
 * audioWord stored in Firestore only when base64 string ≤ 400KB to keep
 * each Firestore doc safely under 1MB.
 */
const FIRESTORE_AUDIO_MAX = 400 * 1024;  // 400KB base64 — for audioWord
const FIRESTORE_IMAGE_MAX = 300 * 1024;  // 300KB base64 — for imageData
// Combined budget per doc kept under ~800KB so full doc stays < 1MB

export async function batchImportCards(uid, deckId, cards, onProgress) {
  // Smaller batches because some docs include audio data
  const BATCH_SIZE = 15;
  const PARALLEL   = 4;

  const allChunks = [];
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    allChunks.push(cards.slice(i, i + BATCH_SIZE));
  }

  let imported = 0;
  const allMediaEntries = []; // [{id, audioExA, audioExB, imageData}] for IndexedDB

  for (let g = 0; g < allChunks.length; g += PARALLEL) {
    const group = allChunks.slice(g, g + PARALLEL);

    const results = await Promise.all(group.map(async (chunk) => {
      const batch   = writeBatch(db);
      const entries = [];

      chunk.forEach(card => {
        const ref = doc(collection(db, 'users', uid, 'cards'));

        // Store audioWord + imageData in Firestore if small enough → cross-device sync
        const audioWordFs = card.audioWord &&
          card.audioWord.length <= FIRESTORE_AUDIO_MAX
          ? card.audioWord : null;

        const audioSize  = audioWordFs ? audioWordFs.length : 0;
        const imageDataFs = card.imageData &&
          card.imageData.length <= FIRESTORE_IMAGE_MAX &&
          (audioSize + card.imageData.length) <= 750 * 1024
          ? card.imageData : null;

        batch.set(ref, {
          deckId,
          front:       card.front       || '',
          back:        card.back        || '',
          suggestion:  card.suggestion  || '',
          topic:       card.topic       || '',
          importOrder: card.importOrder ?? 0,
          phonetic:    card.phonetic    || '',
          pos:         card.pos         || '',
          examplesEn:  card.examplesEn  || [],
          examplesVn:  card.examplesVn  || [],
          translation: card.translation || '',
          tags:        card.tags        || [],
          audioWord:   audioWordFs      || '',  // ← synced via Firestore
          imageData:   imageDataFs      || '',  // ← synced via Firestore
          createdAt:   serverTimestamp(),
          ...createCard(),
        });

        // Larger media stays local (IndexedDB only)
        entries.push({
          id:        ref.id,
          audioWord: card.audioWord || null,   // full version (may be larger)
          audioExA:  card.audioExA  || null,
          audioExB:  card.audioExB  || null,
          imageData: card.imageData || null,
        });
      });

      await batch.commit();
      return entries;
    }));

    results.forEach(entries => allMediaEntries.push(...entries));
    imported += group.reduce((s, c) => s + c.length, 0);
    if (onProgress) onProgress(Math.min(imported, cards.length), cards.length);
  }

  // Persist all media to IndexedDB (for local fast access + examples/images)
  await storeMediaBatch(allMediaEntries);

  await updateDeckCount(uid, deckId);
}

// ── Stats ─────────────────────────────────────────────

export async function getStats(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'stats'));
  if (snap.empty) return { streak: 0, totalReviewed: 0, lastReviewDate: null, history: [] };
  return snap.docs[0].data();
}

export async function updateStats(uid, updates) {
  const ref = doc(db, 'users', uid, 'stats', 'summary');
  await setDoc(ref, updates, { merge: true });
}

// ── Real-time listener ────────────────────────────────

export function subscribeToCards(uid, deckId, callback) {
  const q = deckId
    ? query(collection(db, 'users', uid, 'cards'), where('deckId', '==', deckId))
    : collection(db, 'users', uid, 'cards');
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToDecks(uid, callback) {
  return onSnapshot(collection(db, 'users', uid, 'decks'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

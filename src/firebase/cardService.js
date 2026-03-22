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
 * TEXT fields → Firestore (stays well under 1MB/doc limit)
 * MEDIA fields → IndexedDB (audio/images can be several MB per card)
 */
export async function batchImportCards(uid, deckId, cards, onProgress) {
  const BATCH_SIZE = 200; // text-only docs are tiny — 200/batch is fine
  const PARALLEL   = 5;

  const allChunks = [];
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    allChunks.push(cards.slice(i, i + BATCH_SIZE));
  }

  let imported = 0;
  const allMediaEntries = []; // [{id, audioWord, audioExA, audioExB, imageData}]

  for (let g = 0; g < allChunks.length; g += PARALLEL) {
    const group = allChunks.slice(g, g + PARALLEL);

    const results = await Promise.all(group.map(async (chunk) => {
      const batch   = writeBatch(db);
      const entries = [];

      chunk.forEach(card => {
        const ref = doc(collection(db, 'users', uid, 'cards'));
        // Only text fields in Firestore — keeps each doc well under 1MB
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
          createdAt:   serverTimestamp(),
          ...createCard(),
        });
        // Collect media keyed by the Firestore doc ID
        entries.push({
          id:        ref.id,
          audioWord: card.audioWord || null,
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

  // Persist all media to IndexedDB in one transaction
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

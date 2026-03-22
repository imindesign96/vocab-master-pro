/**
 * .apkg importer — reads Anki model field names from DB,
 * maps fields by name (not position) for any deck layout.
 */
import JSZip from 'jszip';

export async function importApkg(file, onProgress) {
  // ── Load ZIP ──────────────────────────────────────────
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Cannot read file — make sure it is a valid .apkg file.');
  }

  const dbFile = zip.file('collection.anki2') || zip.file('collection.anki21');
  if (!dbFile) throw new Error('Invalid .apkg: no collection.anki2 found.');

  const dbBuf = await dbFile.async('arraybuffer');

  // ── Load SQL.js ───────────────────────────────────────
  let SQL;
  try {
    const initSqlJs = (await import('sql.js')).default;
    SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  } catch (e) {
    throw new Error('SQL engine failed: ' + e.message);
  }

  let db;
  try {
    db = new SQL.Database(new Uint8Array(dbBuf));
  } catch (e) {
    throw new Error('Cannot open Anki database: ' + e.message);
  }

  // ── Media map: original_filename → zip entry number ───
  // e.g. { "ABIDE+BY_1380530514437.mp3": "0", "image.jpg": "1" }
  const mediaMap = {};
  const mediaFile = zip.file('media');
  if (mediaFile) {
    try {
      const json = JSON.parse(await mediaFile.async('text'));
      for (const [num, name] of Object.entries(json)) mediaMap[name] = num;
    } catch { /* ignore */ }
  }

  // ── Read model definitions: mid → [fieldName0, fieldName1, ...] ──
  const models = {}; // mid (string) → string[]
  try {
    const r = db.exec("SELECT models FROM col LIMIT 1");
    const raw = r[0]?.values?.[0]?.[0];
    if (raw) {
      const modelsJson = JSON.parse(raw);
      for (const [mid, model] of Object.entries(modelsJson)) {
        const sorted = [...(model.flds || [])].sort((a, b) => a.ord - b.ord);
        models[mid] = sorted.map(f => f.name.toLowerCase().trim());
      }
    }
  } catch { /* fall back to positional parsing */ }

  // ── Read deck names: did → full deck name ─────────────
  // e.g. "600 essential words::01. Contract"
  const deckNames = {}; // did (string) → full name
  try {
    const r = db.exec("SELECT decks FROM col LIMIT 1");
    const raw = r[0]?.values?.[0]?.[0];
    if (raw) {
      for (const [id, deck] of Object.entries(JSON.parse(raw))) {
        deckNames[id] = deck.name || '';
      }
    }
  } catch { /* ignore */ }

  // ── Deck name ─────────────────────────────────────────
  let deckName = file.name.replace(/\.apkg$/i, '');
  try {
    const r = db.exec("SELECT decks FROM col LIMIT 1");
    const raw = r[0]?.values?.[0]?.[0];
    if (raw) {
      const decks = Object.values(JSON.parse(raw))
        .filter(d => d.id !== 1 && d.name !== 'Default');
      if (decks.length > 0) deckName = decks[0].name || deckName;
    }
  } catch { /* use filename */ }

  // ── Notes ─────────────────────────────────────────────
  // ── Join notes + cards to get deck per note ───────────
  let rows;
  try {
    // Each note can have multiple cards (different card types), take first card's did
    const r = db.exec(`
      SELECT n.id, n.mid, n.flds, n.tags, MIN(c.did) as did
      FROM notes n
      LEFT JOIN cards c ON c.nid = n.id
      GROUP BY n.id
    `);
    rows = r[0]?.values || [];
  } catch (e) {
    // Fallback: without deck info
    try {
      const r = db.exec("SELECT id, mid, flds, tags, 0 FROM notes");
      rows = r[0]?.values || [];
    } catch (e2) {
      throw new Error('Cannot read notes: ' + e2.message);
    }
  }
  if (rows.length === 0) throw new Error('No cards found in this deck.');

  const cards = [];
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    if (onProgress) onProgress(i + 1, total);

    const [, mid, flds, tags, did] = rows[i];

    // Resolve topic from subdeck name, e.g. "Deck::01. Contract" → "01. Contract"
    const fullDeckName = deckNames[String(did)] || '';
    const parts = fullDeckName.split('::');
    const topic = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const rawFields = (flds || '').split('\x1f');
    const fieldNames = models[String(mid)] || [];

    // Build named map (lowercase key → raw html value)
    const named = {};
    fieldNames.forEach((name, idx) => { named[name] = rawFields[idx] || ''; });

    // ── Extract audio filenames BEFORE stripping HTML ──
    const allSounds = extractAllSounds(rawFields);

    // ── Get specific audio fields by name ─────────────
    // Try named fields first (Pronouncing, Sound_a, Sound_b)
    // then fall back to ordered sounds from all fields
    const pronouncingRaw = named['pronouncing'] || named['pronunciation'] || named['audio'] || '';
    const soundARaw      = named['sound_a']     || named['sounda']       || named['audio_a'] || '';
    const soundBRaw      = named['sound_b']     || named['soundb']       || named['audio_b'] || '';

    const audioWordSrc = extractFirstSound(pronouncingRaw) || allSounds[0] || null;
    const audioExASrc  = extractFirstSound(soundARaw)      || allSounds[1] || null;
    const audioExBSrc  = extractFirstSound(soundBRaw)      || allSounds[2] || null;

    // ── Get image ──────────────────────────────────────
    const imageRaw = named['image'] || findImageField(rawFields);
    const imageSrc = extractImgSrc(imageRaw);

    // ── Map card fields by name ────────────────────────
    const explanation  = strip(named['explanation']  || named['definition'] || rawFields[0] || '');
    const suggestion   = strip(named['suggestion']   || named['hint']       || '');
    const vietnamese   = strip(named['vietnamese']   || named['viet']       || named['meaning'] || '');
    const targetWord   = strip(named['target word']  || named['targetword'] || named['word']     || '');
    const transcription= strip(named['transcription']|| named['phonetic']   || named['ipa']      || '');
    const wordType     = strip(named['word type']    || named['wordtype']   || named['pos']      || named['word_type'] || '');
    const exampleRaw   = strip(named['example']      || named['examples']   || '');
    const translationRaw = strip(named['translation']|| '');

    // If no named fields found, fall back to positional heuristics
    const front = targetWord || findWordField(rawFields, fieldNames);
    if (!front) continue;

    // Parse examples
    const examplesEn = parseExamples(exampleRaw, false);
    const examplesVn = parseExamples(translationRaw, true);

    // ── Extract media ──────────────────────────────────
    const imageData  = imageSrc   ? await extractMedia(zip, mediaMap, imageSrc,   'image') : null;
    const audioWord  = audioWordSrc ? await extractMedia(zip, mediaMap, audioWordSrc, 'audio') : null;
    const audioExA   = audioExASrc  ? await extractMedia(zip, mediaMap, audioExASrc,  'audio') : null;
    const audioExB   = audioExBSrc  ? await extractMedia(zip, mediaMap, audioExBSrc,  'audio') : null;

    cards.push({
      front,
      back:        explanation,
      suggestion,
      topic,
      importOrder: i,   // preserve original Anki order within deck          // pre-masked hint from deck (e.g. "a__ __ __ __   b__")
      phonetic:    transcription,
      pos:         wordType,
      examplesEn,
      examplesVn,
      translation: vietnamese,
      imageData,
      audioWord,
      audioExA,
      audioExB,
      tags: tags ? tags.trim().split(/\s+/).filter(Boolean) : [],
    });
  }

  db.close();
  return { deckName, cards };
}

// ── Helpers ───────────────────────────────────────────

/** Extract all [sound:filename] from an array of raw fields, in order */
function extractAllSounds(fields) {
  const sounds = [];
  const rx = /\[sound:([^\]]+)\]/gi;
  for (const f of fields) {
    let m;
    const r = new RegExp(rx.source, 'gi');
    while ((m = r.exec(f)) !== null) sounds.push(m[1]);
  }
  return sounds;
}

/** Extract first [sound:filename] from a single raw field */
function extractFirstSound(raw) {
  const m = raw.match(/\[sound:([^\]]+)\]/i);
  return m ? m[1] : null;
}

/** Extract img src from raw HTML field */
function extractImgSrc(raw) {
  const m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** Find the first field that contains an img tag */
function findImageField(fields) {
  return fields.find(f => /<img/i.test(f)) || '';
}

/**
 * Parse example sentences from "a.Sentence one. b.Sentence two." format.
 *
 * Strategy: scan for [abcd]. prefixes preceded by start-of-string or whitespace.
 * Collect the FULL content between prefixes — never truncate mid-word.
 *
 * "a.paperwork. b.second gear." → ["paperwork.", "second gear."]  ✓
 * NOT ["paperwor", "k. b.second gea", ...]                        ✗
 */
function parseExamples(text) {
  if (!text) return [];

  const rx = /(?:^|\s)([abcd])\.\s*/g;
  const segments = []; // { contentStart, matchStart }
  let m;

  while ((m = rx.exec(text)) !== null) {
    // contentStart = right after the "a. " prefix
    const contentStart = m.index + m[0].length;
    segments.push({ matchStart: m.index, contentStart });
    // Advance lastIndex past the prefix so next search starts from content
    rx.lastIndex = contentStart;
  }

  if (segments.length === 0) {
    // No a./b. prefixes — try newline split
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 2);
    return lines.length > 0 ? lines : text.trim() ? [text.trim()] : [];
  }

  const results = [];
  for (let i = 0; i < segments.length; i++) {
    const from = segments[i].contentStart;
    // Content ends at the MATCH START of the next prefix (keeps the period after last word)
    const to   = i + 1 < segments.length ? segments[i + 1].matchStart : text.length;
    const content = text.slice(from, to).trim();
    if (content.length > 1) results.push(content);
  }
  return results;
}

/** Heuristic: find the target word when no named fields available */
function findWordField(fields, fieldNames) {
  const viRx = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
  const posRx = /^\/[a-z]+\.?\/?/i;
  const soundRx = /\[sound:/i;

  for (const raw of fields) {
    if (soundRx.test(raw) || /<img/i.test(raw)) continue;
    const f = strip(raw);
    if (!f || f.length > 60 || f.length < 2) continue;
    if (posRx.test(f)) continue;
    if (viRx.test(f)) continue;
    if (/[.!?]$/.test(f)) continue;
    if (/^[a-z]\./i.test(f)) continue;
    // Looks like a word/phrase
    if (/^[\w\s\-']+$/.test(f)) return f;
  }
  return strip(fields[0] || '');
}

// ── Media extraction ──────────────────────────────────

async function extractMedia(zip, mediaMap, filename, type) {
  try {
    // mediaMap maps original filename → zip number (e.g. "0", "1", ...)
    const zipKey = mediaMap[filename] ?? filename;
    const entry  = zip.file(zipKey) || zip.file(filename);
    if (!entry) {
      console.warn(`[apkg] media not found: ${filename} (zipKey: ${zipKey})`);
      return null;
    }

    const buf = await entry.async('arraybuffer');

    // Media is stored in IndexedDB (not Firestore) — can be larger
    const maxBytes = type === 'audio' ? 600 * 1024 : 800 * 1024;
    if (buf.byteLength > maxBytes) {
      console.warn(`[apkg] skipping large ${type}: ${filename} (${(buf.byteLength/1024).toFixed(0)}KB)`);
      return null;
    }

    const b64  = arrayBufferToBase64(buf);
    const mime = getMime(filename, type);
    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.warn(`[apkg] error extracting ${filename}:`, e);
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function getMime(filename, type) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (type === 'image') {
    return { png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/jpeg';
  }
  return { ogg: 'audio/ogg', wav: 'audio/wav' }[ext] || 'audio/mpeg';
}

/** Strip HTML tags and Anki sound/img tags from a string */
function strip(html) {
  if (!html) return '';
  return html
    .replace(/\[sound:[^\]]+\]/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<div[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

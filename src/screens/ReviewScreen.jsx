import { useState, useEffect, useCallback, useRef } from 'react';
import AnswerButtons from '../components/AnswerButtons';
import { getDailyQueue, processReview, QUALITY } from '../utils/srsEngine';
import { updateCard, updateStats } from '../firebase/cardService';
import { getMedia } from '../utils/mediaStorage';

// ── Audio helpers ──────────────────────────────────────

// Shared active-audio ref — cancel previous before playing new
let _activeAudio = null;

function speakTTS(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function playAudio(dataUrl, fallbackText) {
  // Cancel whatever is playing now
  if (_activeAudio) { _activeAudio.pause(); _activeAudio = null; }
  window.speechSynthesis?.cancel();

  if (dataUrl) {
    const a = new Audio(dataUrl);
    _activeAudio = a;
    a.play().catch(() => fallbackText && speakTTS(fallbackText));
    a.onended = () => { if (_activeAudio === a) _activeAudio = null; };
  } else if (fallbackText) {
    speakTTS(fallbackText);
  }
}

/**
 * Mask word for hint display.
 * Shows first + last letter of each word, hides the middle with `_` per char.
 * "attract"  → "a_____t"
 * "abide by" → "a___e by"
 * "go"       → "go"
 *
 * If the card has a `suggestion` field from the deck, clean it up and use that.
 */
function maskWord(word) {
  return word.split(' ').map(w => {
    if (!w) return '';
    if (w.length <= 2) return w;
    const hidden = '_'.repeat(w.length - 2);
    return w[0] + hidden + w[w.length - 1];
  }).join(' ');
}

/**
 * Clean up a deck-provided suggestion field.
 * - Replace `__` with `_` (one underscore per hidden letter)
 * - For single-word answers: remove ALL spaces inside the suggestion
 * - For multi-word answers: keep one space between words
 */
function cleanSuggestion(sug, front) {
  if (!sug) return '';
  let s = sug.replace(/__/g, '_').trim();

  const wordCount = (front || '').split(' ').filter(Boolean).length;
  if (wordCount <= 1) {
    // Single word — suggestion must have no spaces at all
    s = s.replace(/\s+/g, '');
  } else {
    // Multi-word — collapse multiple spaces to one
    s = s.replace(/\s{2,}/g, ' ');
  }
  return s;
}

/** Exact match only — no fuzzy. Case-insensitive, trim whitespace. */
function checkAnswer(input, answer) {
  const a = input.toLowerCase().trim().replace(/\s+/g, ' ');
  const b = answer.toLowerCase().trim().replace(/\s+/g, ' ');
  return a === b;
}

// ── Main component ─────────────────────────────────────

export default function ReviewScreen({ cards, uid, onDone, onCardUpdated, newPerDay }) {
  const queue = useRef(getDailyQueue(cards, newPerDay));
  const [current, setCurrent] = useState(0);
  const [typed, setTyped]         = useState('');
  const [checked, setChecked]     = useState(false);  // true = show answer buttons
  const [correct, setCorrect]     = useState(false);
  const [attempts, setAttempts]   = useState(0);      // wrong attempts so far
  const [lastWrong, setLastWrong] = useState('');     // last wrong typed value
  const [stats, setStats]         = useState({ reviewed: 0, rightFirst: 0 });
  const [media, setMedia]         = useState({});     // IDB media for current card
  const MAX_ATTEMPTS = 3;
  const inputRef = useRef(null);

  const card = queue.current[current];

  // Load media from IndexedDB whenever the card changes
  useEffect(() => {
    if (!card?.id) { setMedia({}); return; }
    getMedia(card.id).then(m => setMedia(m || {}));
  }, [card?.id]);

  // Reset state + auto-play word audio on each new card
  useEffect(() => {
    setTyped('');
    setChecked(false);
    setCorrect(false);
    setAttempts(0);
    setLastWrong('');
  }, [current, card?.id]);

  // Auto-play word audio when question appears (after media loaded)
  useEffect(() => {
    if (!card || checked) return;
    const t = setTimeout(() => playAudio(media.audioWord, card.front), 400);
    return () => clearTimeout(t);
  }, [card?.id, media.audioWord]); // fires once media is loaded for new card

  // Focus input when not checked
  useEffect(() => {
    if (!checked && inputRef.current) inputRef.current.focus();
  }, [current, checked]);

  const handleCheck = useCallback(() => {
    if (!typed.trim() || !card) return;
    const isCorrect = checkAnswer(typed, card.front);

    if (isCorrect) {
      setCorrect(true);
      setChecked(true);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setLastWrong(typed);

      if (newAttempts >= MAX_ATTEMPTS) {
        // Out of attempts — reveal answer
        setCorrect(false);
        setChecked(true);
      } else {
        // Allow retry — clear input, keep wrong feedback briefly
        setTyped('');
        // Focus input again handled by useEffect below
      }
    }
  }, [typed, card, attempts]);

  const handleAnswer = useCallback(async (quality) => {
    if (!card) return;
    const updated = processReview(card, quality);
    await updateCard(uid, card.id, updated);
    onCardUpdated({ ...card, ...updated });

    const isRight = quality >= QUALITY.GOOD;
    setStats(s => ({ reviewed: s.reviewed + 1, rightFirst: s.rightFirst + (isRight ? 1 : 0) }));

    if (quality === QUALITY.AGAIN) {
      queue.current = [...queue.current, { ...card, ...updated }];
    }
    setCurrent(c => c + 1);
  }, [card, uid, onCardUpdated]);

  // Save stats on session end
  useEffect(() => {
    if (current >= queue.current.length && stats.reviewed > 0) {
      const today = new Date().toISOString().split('T')[0];
      updateStats(uid, { lastReviewDate: today, totalReviewed: stats.reviewed }).catch(() => {});
    }
  }, [current, stats, uid]);

  // ── Session done ─────────────────────────────────────
  if (current >= queue.current.length) {
    const ret = stats.reviewed > 0
      ? Math.round((stats.rightFirst / stats.reviewed) * 100) : 0;
    return (
      <div className="done-screen">
        <span className="done-emoji">🎉</span>
        <h2>Session Complete!</h2>
        <div className="done-stats">
          <Bubble n={stats.reviewed} label="Reviewed" />
          <Bubble n={`${ret}%`} label="Correct" />
          <Bubble n={stats.rightFirst} label="Right" />
        </div>
        <button className="start-btn" onClick={onDone}>← Back to Today</button>
      </div>
    );
  }

  const total   = queue.current.length;
  const progress = current / Math.max(total, 1);
  // Use deck suggestion (cleaned) if available, else compute from front
  const masked = card
    ? (card.suggestion ? cleanSuggestion(card.suggestion, card.front) : maskWord(card.front))
    : '';

  // ── Render ────────────────────────────────────────────
  return (
    <div className="review-screen">
      {/* Progress bar */}
      <div className="rpbar"><div className="rpbar-fill" style={{ width: `${progress * 100}%` }} /></div>

      {/* Counter */}
      <div className="review-counter">
        <span className="cnt-cur">{current + 1}</span>
        <span className="cnt-sep"> / </span>
        <span className="cnt-tot">{total}</span>
        <StateBadge state={card?.state} />
      </div>

      <div className="review-body">
        {/* ── QUESTION AREA ── */}
        <div className="question-card">
          {card?.pos && <span className="q-pos">{card.pos}</span>}

          {/* Masked word + replay button */}
          <div className="q-masked-row">
            <p className="q-masked">{masked}</p>
            <button
              className="q-replay-btn"
              onClick={() => playAudio(media.audioWord, card?.front)}
              title="Play audio"
            >🔊</button>
          </div>

          {/* Definitions */}
          {card?.back && <p className="q-def">{card.back.split('\n')[0]}</p>}
          {card?.translation && (
            <p className="q-trans">🇻🇳 {card.translation}</p>
          )}

          {/* Image (always visible) */}
          {media.imageData && (
            <img className="q-image" src={media.imageData} alt="" />
          )}

          {/* Input */}
          <div className="q-input-row">
            <input
              ref={inputRef}
              className={`q-input ${checked ? (correct ? 'inp-correct' : 'inp-wrong') : ''}`}
              placeholder="Type the word..."
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !checked && handleCheck()}
              disabled={checked}
              autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            />
          </div>

          {/* Retry feedback — wrong but still has attempts left */}
          {!checked && attempts > 0 && lastWrong && (
            <div className="retry-feedback">
              <span className="retry-wrong">✗ "{lastWrong}"</span>
              <span className="retry-remaining">
                {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} left
              </span>
            </div>
          )}

          {!checked && (
            <button className="check-btn" onClick={handleCheck} disabled={!typed.trim()}>
              Check Answer ↵
            </button>
          )}
        </div>

        {/* ── RESULT AREA (after checking) ── */}
        {checked && (
          <div className="result-card">
            {correct
              ? <p className="result-correct">
                  ✓ Correct!{attempts > 0 ? ` (${attempts + 1} attempt${attempts > 1 ? 's' : ''})` : ''}
                </p>
              : <div className="result-wrong">
                  <p>✗ You typed: <span className="typed-text">"{lastWrong || typed}"</span></p>
                  <p>✓ Answer: <span className="answer-text">"{card.front}"</span></p>
                </div>
            }

            {/* Audio buttons */}
            <div className="audio-row">
              <AudioBtn
                label="Word"
                dataUrl={media.audioWord}
                fallback={card.front}
                autoPlay
              />
              {card.examplesEn?.[0] && (
                <AudioBtn
                  label="Example A"
                  dataUrl={media.audioExA}
                  fallback={card.examplesEn[0]}
                />
              )}
              {card.examplesEn?.[1] && (
                <AudioBtn
                  label="Example B"
                  dataUrl={media.audioExB}
                  fallback={card.examplesEn[1]}
                />
              )}
            </div>

            {/* Full word + phonetic */}
            <div className="revealed-word">
              <span className="rw-word">{card.front}</span>
              {card.phonetic && <span className="rw-phonetic">{card.phonetic}</span>}
              {card.pos && <span className="rw-pos">{card.pos}</span>}
            </div>

            {/* Examples */}
            {(card.examplesEn?.length > 0 || card.examplesVn?.length > 0) && (
              <div className="examples-block">
                {card.examplesEn?.map((ex, i) => (
                  <p key={i} className="ex-en">"{ex}"</p>
                ))}
                {card.examplesVn?.map((ex, i) => (
                  <p key={i} className="ex-vn">→ {ex}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Answer buttons — only after check */}
      {checked && (
        <div className="answer-buttons-wrap">
          <AnswerButtons card={card} onAnswer={handleAnswer} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function AudioBtn({ label, dataUrl, fallback, autoPlay }) {
  const [playing, setPlaying] = useState(false);
  const didAutoPlay = useRef(false); // guard: only auto-play once per mount

  // Auto-play once when dataUrl becomes available (media loaded from IDB)
  useEffect(() => {
    if (!autoPlay || didAutoPlay.current) return;
    didAutoPlay.current = true;
    // Small delay so it plays AFTER any previous audio has been cancelled
    const t = setTimeout(() => handlePlay(), 150);
    return () => clearTimeout(t);
  }, [autoPlay, dataUrl]); // re-check when dataUrl arrives from IDB

  function handlePlay() {
    setPlaying(true);
    if (dataUrl) {
      // Use shared playAudio so it cancels any currently playing audio
      if (_activeAudio) { _activeAudio.pause(); _activeAudio = null; }
      window.speechSynthesis?.cancel();
      const a = new Audio(dataUrl);
      _activeAudio = a;
      a.onended = () => { setPlaying(false); if (_activeAudio === a) _activeAudio = null; };
      a.play().catch(() => { speakTTS(fallback); setPlaying(false); });
    } else if (fallback) {
      speakTTS(fallback);
      setTimeout(() => setPlaying(false), 1500);
    } else {
      setPlaying(false);
    }
  }

  return (
    <button className={`audio-pill ${playing ? 'playing' : ''}`} onClick={handlePlay}>
      <span className="audio-pill-icon">{playing ? '🔉' : '🔊'}</span>
      <span className="audio-pill-label">{label}</span>
    </button>
  );
}

function StateBadge({ state }) {
  const colors = { new: '#64748b', learning: '#f97316', review: '#6366f1', relearning: '#ef4444' };
  const labels = { new: 'New', learning: 'Learn', review: 'Review', relearning: 'Relearn' };
  if (!state) return null;
  return <span className="state-badge" style={{ background: colors[state] }}>{labels[state]}</span>;
}

function Bubble({ n, label }) {
  return (
    <div className="done-bubble">
      <span className="done-n">{n}</span>
      <span className="done-lbl">{label}</span>
    </div>
  );
}

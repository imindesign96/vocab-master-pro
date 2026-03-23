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
 * Progressive mask — reveals more letters from outside-in on each wrong attempt.
 * attempt=0: first + last only         "attract"  → "a_____t"
 * attempt=1: +2 chars from outside-in  "attract"  → "at___ct"
 * attempt=2: +2 more                   "attract"  → "att_act"
 * attempt≥3: fully revealed            "attract"  → "attract"
 */
function maskWordProgressive(word, attempt) {
  return word.split(' ').map(w => {
    if (!w) return '';
    if (w.length <= 2) return w;
    const chars = w.split('');
    const revealed = new Set([0, w.length - 1]); // always show first + last
    // Each attempt reveals 2 more chars (one from each side)
    let left = 1, right = w.length - 2;
    let extra = attempt * 2; // 2 more chars per wrong attempt
    while (extra > 0 && left <= right) {
      revealed.add(left++); extra--;
      if (extra > 0 && left <= right) { revealed.add(right--); extra--; }
    }
    return chars.map((c, i) => revealed.has(i) ? c : '_').join('');
  }).join(' ');
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
  const [stats, setStats]         = useState({ reviewed: 0, rightFirst: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [media, setMedia]         = useState({});     // IDB media for current card
  const [retrying, setRetrying]   = useState(false);  // true after "Học lại" pressed
  const startTime                 = useRef(Date.now());
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
    setRetrying(false);
  }, [current, card?.id]);

  // Resolve media: IndexedDB (local, full quality) → Firestore (synced) → TTS
  const audioWord = media.audioWord || card?.audioWord || null;
  const imageData = media.imageData || card?.imageData || null;

  // Auto-play word audio when question appears (after media loaded)
  useEffect(() => {
    if (!card || checked) return;
    const t = setTimeout(() => playAudio(audioWord, card.front), 400);
    return () => clearTimeout(t);
  }, [card?.id, audioWord]); // fires once media/card audio is ready

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
    const qKey = { [QUALITY.AGAIN]: 'again', [QUALITY.HARD]: 'hard', [QUALITY.GOOD]: 'good', [QUALITY.EASY]: 'easy' }[quality];
    setStats(s => ({
      ...s,
      reviewed: s.reviewed + 1,
      rightFirst: s.rightFirst + (isRight ? 1 : 0),
      [qKey]: (s[qKey] || 0) + 1,
    }));

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
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    return <SessionSummary stats={stats} elapsed={elapsed} onDone={onDone} />;
  }

  const total    = queue.current.length;
  const progress = current / Math.max(total, 1);
  // Progressive mask: reveals more letters per wrong attempt
  const masked = card ? maskWordProgressive(card.front, attempts) : '';

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
              onClick={() => playAudio(audioWord, card?.front)}
              title="Play audio"
            >🔊</button>
          </div>

          {/* Definitions */}
          {card?.back && <p className="q-def">{card.back.split('\n')[0]}</p>}
          {card?.translation && (
            <p className="q-trans">🇻🇳 {card.translation}</p>
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
                {MAX_ATTEMPTS - attempts} lần còn lại
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
                  ✓ Đúng!{attempts > 0 ? ` (sau ${attempts + 1} lần)` : ''}
                </p>
              : <div className="result-wrong">
                  <p>✗ Bạn nhập: <span className="typed-text">"{lastWrong || typed}"</span></p>
                  <p>✓ Đáp án: <span className="answer-text">"{card.front}"</span></p>
                  <button
                    className="retry-again-btn"
                    onClick={() => {
                      setChecked(false);
                      setTyped('');
                      setAttempts(0);
                      setLastWrong('');
                      setRetrying(true);
                    }}
                  >🔄 Học lại</button>
                </div>
            }

            {/* Audio buttons */}
            <div className="audio-row">
              <AudioBtn
                label="Word"
                dataUrl={audioWord}
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

            {/* Image — IndexedDB (local) → Firestore (synced) */}
            {imageData && (
              <img className="q-image" src={imageData} alt="" />
            )}

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

function SessionSummary({ stats, elapsed, onDone }) {
  const { reviewed, rightFirst, again, hard, good, easy } = stats;
  const accuracy = reviewed > 0 ? Math.round((rightFirst / reviewed) * 100) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const emoji = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎉' : accuracy >= 50 ? '💪' : '📖';
  const msg   = accuracy >= 90 ? 'Xuất sắc!' : accuracy >= 70 ? 'Tốt lắm!' : accuracy >= 50 ? 'Cố lên!' : 'Tiếp tục luyện tập!';

  return (
    <div className="summary-screen">
      <div className="summary-hero">
        <span className="summary-emoji">{emoji}</span>
        <h2 className="summary-title">Hoàn thành!</h2>
        <p className="summary-msg">{msg}</p>
      </div>

      {/* Main stats row */}
      <div className="summary-stats-row">
        <div className="summary-stat">
          <span className="ss-val">{reviewed}</span>
          <span className="ss-lbl">Thẻ học</span>
        </div>
        <div className="summary-stat accent">
          <span className="ss-val">{accuracy}%</span>
          <span className="ss-lbl">Chính xác</span>
        </div>
        <div className="summary-stat">
          <span className="ss-val">{timeStr}</span>
          <span className="ss-lbl">Thời gian</span>
        </div>
      </div>

      {/* Accuracy bar */}
      <div className="summary-bar-wrap">
        <div className="summary-bar">
          <div className="summary-bar-fill" style={{ width: `${accuracy}%` }} />
        </div>
        <div className="summary-bar-labels">
          <span>{rightFirst} đúng</span>
          <span>{reviewed - rightFirst} sai</span>
        </div>
      </div>

      {/* Button breakdown */}
      {reviewed > 0 && (
        <div className="summary-btns-row">
          {again > 0 && <div className="sb-chip sb-again">Again <strong>{again}</strong></div>}
          {hard  > 0 && <div className="sb-chip sb-hard">Hard <strong>{hard}</strong></div>}
          {good  > 0 && <div className="sb-chip sb-good">Good <strong>{good}</strong></div>}
          {easy  > 0 && <div className="sb-chip sb-easy">Easy <strong>{easy}</strong></div>}
        </div>
      )}

      <button className="summary-done-btn" onClick={onDone}>← Về trang chủ</button>
    </div>
  );
}

function StateBadge({ state }) {
  const colors = { new: '#64748b', learning: '#f97316', review: '#6366f1', relearning: '#ef4444' };
  const labels = { new: 'New', learning: 'Learn', review: 'Review', relearning: 'Relearn' };
  if (!state) return null;
  return <span className="state-badge" style={{ background: colors[state] }}>{labels[state]}</span>;
}


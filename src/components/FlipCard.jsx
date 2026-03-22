import { useState, useEffect } from 'react';

// TTS — speak the word aloud
export function speakWord(text, lang = 'en-US') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

export default function FlipCard({ card, onReveal }) {
  const [flipped, setFlipped] = useState(false);

  // Reset when card changes
  useEffect(() => { setFlipped(false); }, [card?.id]);

  const handleCardClick = (e) => {
    // Don't flip if clicking audio/image buttons
    if (e.target.closest('.audio-btn')) return;
    const next = !flipped;
    setFlipped(next);
    if (next && onReveal) onReveal();
  };

  const handleSpeak = (e) => {
    e.stopPropagation();
    if (card?.audioData) {
      // Play embedded audio from .apkg
      const audio = new Audio(card.audioData);
      audio.play().catch(() => speakWord(card.front));
    } else {
      speakWord(card?.front || '');
    }
  };

  if (!card) return null;

  const hasImage = !!card.imageData;
  const hasExamples = (card.examplesEn?.length > 0) || (card.examplesVn?.length > 0);

  return (
    <div className="flip-card-scene" onClick={handleCardClick}>
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>

        {/* ── FRONT ─────────────────────────── */}
        <div className="flip-card-front">
          <div className="card-content">
            {card.pos && <span className="card-pos">{card.pos}</span>}
            <p className="card-word">{card.front}</p>
            {card.phonetic && <p className="card-phonetic">{card.phonetic}</p>}
            <button className="audio-btn" onClick={handleSpeak} title="Listen">
              🔊
            </button>
            {!flipped && <p className="card-hint">Tap to reveal answer</p>}
          </div>
        </div>

        {/* ── BACK ──────────────────────────── */}
        <div className="flip-card-back">
          <div className="card-content card-back-content">
            <div className="back-header">
              <p className="card-word-small">{card.front}</p>
              {card.phonetic && <p className="card-phonetic small">{card.phonetic}</p>}
              <button className="audio-btn" onClick={handleSpeak} title="Listen">🔊</button>
            </div>

            <div className="card-divider" />

            <p className="card-definition">{card.back}</p>

            {card.translation && card.translation !== card.back && (
              <p className="card-translation">🇻🇳 {card.translation}</p>
            )}

            {hasImage && (
              <img
                className="card-image"
                src={card.imageData}
                alt={card.front}
                onClick={e => e.stopPropagation()}
              />
            )}

            {hasExamples && (
              <div className="card-examples">
                {card.examplesEn?.slice(0, 2).map((ex, i) => (
                  <p key={i} className="example-en">"{ex}"</p>
                ))}
                {card.examplesVn?.slice(0, 1).map((ex, i) => (
                  <p key={i} className="example-vn">→ {ex}</p>
                ))}
              </div>
            )}

            {/* Legacy back for manually-added cards */}
            {!hasExamples && card.example && (
              <p className="example-en">"{card.example}"</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

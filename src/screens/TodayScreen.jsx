import { useState, useMemo } from 'react';
import { getDailyQueue, CARD_STATE, getRetention, DEFAULT_NEW_PER_DAY } from '../utils/srsEngine';

export default function TodayScreen({ cards, decks, onStartReview, onNavigate, newPerDay, onNewPerDayChange }) {
  const [showSettings, setShowSettings] = useState(false);
  const queue = useMemo(() => getDailyQueue(cards, newPerDay), [cards, newPerDay]);
  const stats = useMemo(() => {
    const due = queue;
    const newCards = due.filter(c => c.state === CARD_STATE.NEW).length;
    const learning = due.filter(c => c.state === CARD_STATE.LEARNING || c.state === CARD_STATE.RELEARNING).length;
    const review = due.filter(c => c.state === CARD_STATE.REVIEW).length;
    return { total: due.length, newCards, learning, review };
  }, [queue]);

  const totalCards = cards.length;
  const masteredCards = cards.filter(c => c.state === CARD_STATE.REVIEW && c.repetitions >= 5).length;
  const retention = getRetention(cards);

  return (
    <div className="screen today-screen">
      <header className="screen-header today-header">
        <div>
          <h1 className="app-title">FlashAnki</h1>
          <p className="app-sub">Anki-powered vocabulary learning</p>
        </div>
        <button className="settings-toggle-btn" onClick={() => setShowSettings(s => !s)} title="Settings">
          ⚙️
        </button>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <h3 className="settings-title">⚙️ Settings</h3>
          <div className="settings-row">
            <div className="settings-label">
              <span>New cards / day</span>
              <span className="settings-value">{newPerDay}</span>
            </div>
            <input
              type="range"
              min={5} max={100} step={5}
              value={newPerDay}
              onChange={e => onNewPerDayChange(Number(e.target.value))}
              className="settings-slider"
            />
            <div className="settings-ticks">
              {[5, 10, 20, 30, 50, 100].map(v => (
                <button
                  key={v}
                  className={`tick-btn ${newPerDay === v ? 'active' : ''}`}
                  onClick={() => onNewPerDayChange(v)}
                >{v}</button>
              ))}
            </div>
          </div>
          <p className="settings-hint">
            Cards are studied in order: Contract → Marketing → Warranties → …
          </p>
        </div>
      )}

      {/* Due summary card */}
      <div className="due-card">
        {stats.total === 0 ? (
          <div className="all-done">
            <span className="done-emoji">🎉</span>
            <h2>All caught up!</h2>
            <p>Come back tomorrow for your next reviews.</p>
          </div>
        ) : (
          <>
            <div className="due-number">{stats.total}</div>
            <div className="due-label">cards to study today</div>
            <div className="due-breakdown">
              {stats.newCards > 0 && <span className="tag new">{stats.newCards} new</span>}
              {stats.learning > 0 && <span className="tag learning">{stats.learning} learning</span>}
              {stats.review > 0 && <span className="tag review">{stats.review} review</span>}
            </div>
          </>
        )}
      </div>

      {stats.total > 0 && (
        <button className="start-btn" onClick={onStartReview}>
          Start Studying →
        </button>
      )}

      {/* Stats grid */}
      <div className="progress-grid">
        <div className="prog-item">
          <span className="prog-num">{totalCards}</span>
          <span className="prog-lbl">Total</span>
        </div>
        <div className="prog-item">
          <span className="prog-num">{decks.length}</span>
          <span className="prog-lbl">Decks</span>
        </div>
        <div className="prog-item">
          <span className="prog-num">{masteredCards}</span>
          <span className="prog-lbl">Mastered</span>
        </div>
        <div className="prog-item">
          <span className="prog-num">{retention}%</span>
          <span className="prog-lbl">Retention</span>
        </div>
      </div>

      {/* Deck list */}
      {decks.length > 0 && (
        <section className="section">
          <h3 className="section-title">Your Decks</h3>
          {decks.map(deck => {
            const dc = cards.filter(c => c.deckId === deck.id);
            const due = getDailyQueue(dc).length;
            return (
              <div key={deck.id} className="deck-row" onClick={() => onNavigate('decks')}>
                <div className="deck-info">
                  <span className="deck-name">{deck.name}</span>
                  <span className="deck-count">{dc.length} cards</span>
                </div>
                {due > 0 && <span className="deck-due">{due} due</span>}
              </div>
            );
          })}
        </section>
      )}

      {totalCards === 0 && (
        <div className="empty-state">
          <p>No cards yet.</p>
          <button className="link-btn" onClick={() => onNavigate('decks')}>Import a .apkg deck</button>
          <span> or </span>
          <button className="link-btn" onClick={() => onNavigate('add')}>add words manually</button>
        </div>
      )}
    </div>
  );
}

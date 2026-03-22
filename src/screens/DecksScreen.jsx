import { useState, useRef } from 'react';
import { createDeck, deleteDeck, batchImportCards } from '../firebase/cardService';
import { importApkg } from '../utils/apkgImporter';
import { CARD_STATE, isDue } from '../utils/srsEngine';

// View stack: 'list' | 'deck' | 'topic'
export default function DecksScreen({ decks, cards, uid, onUpdate }) {
  const [view, setView]           = useState('list');
  const [selectedDeck, setDeck]   = useState(null);
  const [selectedTopic, setTopic] = useState(null);

  const [newDeckName, setNewDeckName]       = useState('');
  const [importing, setImporting]           = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [deletingId, setDeletingId]         = useState(null);
  const [error, setError]                   = useState('');
  const fileRef = useRef();

  // ── Navigation helpers ────────────────────────────────
  const goList  = ()         => { setView('list');  setDeck(null); setTopic(null); };
  const goDeck  = (deck)     => { setDeck(deck);  setView('deck');  };
  const goTopic = (topic)    => { setTopic(topic); setView('topic'); };
  const goBack  = () => {
    if (view === 'topic') setView('deck');
    else goList();
  };

  // ── Import ─────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setError('');
    setImportProgress({ phase: 'Reading file…', cur: 0, total: 0 });

    try {
      const { deckName, cards: imported } = await importApkg(file, (cur, tot) => {
        setImportProgress({ phase: 'Parsing cards…', cur, total: tot });
      });
      if (imported.length === 0) throw new Error('No cards found in this .apkg file.');

      setImportProgress({ phase: 'Creating deck…', cur: 0, total: imported.length });
      const deckId = await createDeck(uid, deckName);

      await batchImportCards(uid, deckId, imported, (cur, tot) => {
        setImportProgress({ phase: `Saving… ${cur}/${tot}`, cur, total: tot });
      });

      onUpdate();
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = async (deck, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
    setDeletingId(deck.id);
    try {
      await deleteDeck(uid, deck.id);
      if (selectedDeck?.id === deck.id) goList();
      onUpdate();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Create deck ───────────────────────────────────────
  const handleCreate = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    await createDeck(uid, name);
    setNewDeckName('');
    onUpdate();
  };

  // ── Render: deck/topic detail ──────────────────────────
  if (view === 'topic' && selectedDeck && selectedTopic !== null) {
    const topicCards = cards.filter(
      c => c.deckId === selectedDeck.id && (c.topic || '') === selectedTopic
    );
    return (
      <div className="screen decks-screen">
        <SubHeader title={selectedTopic || selectedDeck.name} onBack={goBack} />
        <WordList cards={topicCards} />
      </div>
    );
  }

  if (view === 'deck' && selectedDeck) {
    const deckCards = cards.filter(c => c.deckId === selectedDeck.id);

    // Group by topic, sorted
    const topicMap = {};
    for (const c of deckCards) {
      const t = c.topic || '';
      if (!topicMap[t]) topicMap[t] = [];
      topicMap[t].push(c);
    }
    const topics = Object.keys(topicMap).sort();
    const hasTopics = topics.length > 1 || (topics.length === 1 && topics[0] !== '');

    return (
      <div className="screen decks-screen">
        <SubHeader title={selectedDeck.name} onBack={goBack} />

        <div className="deck-summary">
          <DeckStat n={deckCards.length}                                             label="Total"   />
          <DeckStat n={deckCards.filter(isDue).length}                               label="Due"     color="var(--accent)"  />
          <DeckStat n={deckCards.filter(c => c.state === CARD_STATE.REVIEW).length}  label="Learned" color="var(--green)"   />
        </div>

        {hasTopics ? (
          <div className="topic-list">
            <h3 className="section-title">Topics</h3>
            {topics.map(topic => {
              const tc = topicMap[topic];
              const due     = tc.filter(isDue).length;
              const learned = tc.filter(c => c.state === CARD_STATE.REVIEW).length;
              return (
                <button key={topic} className="topic-row" onClick={() => goTopic(topic)}>
                  <div className="topic-info">
                    <span className="topic-name">{topic || '(No topic)'}</span>
                    <span className="topic-meta">{tc.length} words · {learned} learned</span>
                  </div>
                  <div className="topic-right">
                    {due > 0 && <span className="topic-due">{due}</span>}
                    <span className="topic-chevron">›</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <WordList cards={deckCards} />
        )}
      </div>
    );
  }

  // ── Render: deck list ──────────────────────────────────
  return (
    <div className="screen decks-screen">
      <header className="screen-header"><h2>Decks</h2></header>

      {/* Import */}
      <div className="import-section">
        <h3 className="section-title">Import Anki Deck</h3>
        <button
          className="import-btn"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? '⏳ Importing…' : '📂 Import .apkg file'}
        </button>
        <input ref={fileRef} type="file" accept=".apkg" style={{ display: 'none' }} onChange={handleImport} />

        {importProgress && (
          <div className="import-progress">
            <p className="import-phase">{importProgress.phase}</p>
            {importProgress.total > 0 && (
              <>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${(importProgress.cur / importProgress.total) * 100}%` }} />
                </div>
                <p className="progress-text">{importProgress.cur} / {importProgress.total}</p>
              </>
            )}
          </div>
        )}
        {error && <p className="error-msg">⚠️ {error}</p>}
      </div>

      {/* Create */}
      <div className="create-deck-section">
        <h3 className="section-title">Create Deck</h3>
        <div className="input-row">
          <input
            className="text-input"
            placeholder="Deck name…"
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="add-btn" onClick={handleCreate}>Add</button>
        </div>
      </div>

      {/* List */}
      <div className="deck-list">
        {decks.length === 0 ? (
          <div className="empty-state">No decks yet. Import an .apkg above.</div>
        ) : decks.map(deck => {
          const dc  = cards.filter(c => c.deckId === deck.id);
          const due = dc.filter(isDue).length;
          const isDeleting = deletingId === deck.id;
          return (
            <button
              key={deck.id}
              className={`deck-card ${isDeleting ? 'deleting' : ''}`}
              onClick={() => !isDeleting && goDeck(deck)}
              disabled={isDeleting}
            >
              <div className="deck-card-info">
                <p className="deck-card-name">{deck.name}</p>
                <p className="deck-card-meta">
                  {dc.length} cards{due > 0 ? ` · ${due} due` : ''}
                </p>
              </div>
              <div className="deck-card-right">
                {due > 0 && <span className="deck-due-pill">{due}</span>}
                {!isDeleting && <span className="deck-chevron">›</span>}
                <button
                  className="delete-btn"
                  onClick={(e) => handleDelete(deck, e)}
                  disabled={isDeleting}
                  aria-label="Delete"
                >
                  {isDeleting ? '⏳' : '🗑️'}
                </button>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function SubHeader({ title, onBack }) {
  return (
    <header className="screen-header nav-header">
      <button className="back-nav-btn" onClick={onBack}>← Back</button>
      <h2 className="nav-title">{title}</h2>
    </header>
  );
}

function WordList({ cards }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? cards.filter(c =>
        c.front?.toLowerCase().includes(search.toLowerCase()) ||
        c.back?.toLowerCase().includes(search.toLowerCase())
      )
    : cards;

  const stateDot = {
    [CARD_STATE.NEW]:        '#64748b',
    [CARD_STATE.LEARNING]:   '#f97316',
    [CARD_STATE.REVIEW]:     '#22c55e',
    [CARD_STATE.RELEARNING]: '#ef4444',
  };

  return (
    <>
      <div className="topic-search-row">
        <input
          className="text-input search-input"
          placeholder="Search words…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="topic-count">{filtered.length} words</span>
      </div>
      <div className="word-list">
        {filtered.map((card, idx) => (
          <div key={card.id} className="word-row">
            <span className="word-idx">{idx + 1}</span>
            <div className="word-info">
              <div className="word-row-top">
                <span className="word-front">{card.front}</span>
                {card.pos && <span className="word-pos">{card.pos}</span>}
              </div>
              {card.phonetic && <span className="word-phonetic">{card.phonetic}</span>}
              <span className="word-back">{card.back?.split('\n')[0]}</span>
              {card.translation && <span className="word-vi">🇻🇳 {card.translation}</span>}
            </div>
            <span
              className="word-state-dot"
              style={{ background: stateDot[card.state] || '#64748b' }}
              title={card.state}
            />
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-state">No words found.</div>}
      </div>
    </>
  );
}

function DeckStat({ n, label, color }) {
  return (
    <div className="deck-stat">
      <span className="deck-stat-n" style={color ? { color } : {}}>{n}</span>
      <span className="deck-stat-lbl">{label}</span>
    </div>
  );
}

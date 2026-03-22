import { useState } from 'react';
import { addCard } from '../firebase/cardService';

export default function AddScreen({ decks, uid, onCardAdded }) {
  const [form, setForm] = useState({ front: '', back: '', example: '', deckId: '' });
  const [looking, setLooking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selectedDeck = form.deckId || (decks[0]?.id ?? '');

  const lookupDefinition = async () => {
    const word = form.front.trim().toLowerCase();
    if (!word) return;
    setLooking(true);
    setError('');
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) throw new Error('Word not found');
      const data = await res.json();
      const entry = data[0];
      const meaning = entry.meanings?.[0];
      const def = meaning?.definitions?.[0];

      setForm(f => ({
        ...f,
        back: def?.definition || f.back,
        example: def?.example || f.example,
      }));
    } catch {
      setError('Definition not found. Fill in manually.');
    } finally {
      setLooking(false);
    }
  };

  const handleSave = async () => {
    if (!form.front.trim() || !form.back.trim()) {
      setError('Word and definition are required');
      return;
    }
    if (!selectedDeck) {
      setError('Create a deck first in the Decks tab');
      return;
    }
    setError('');
    await addCard(uid, selectedDeck, {
      front: form.front.trim(),
      back: form.back.trim(),
      example: form.example.trim(),
    });
    setForm({ front: '', back: '', example: '', deckId: form.deckId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onCardAdded();
  };

  return (
    <div className="screen add-screen">
      <header className="screen-header">
        <h2>Add Card</h2>
      </header>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p>Create a deck first in the Decks tab.</p>
        </div>
      ) : (
        <div className="add-form">
          {/* Deck selector */}
          <div className="form-group">
            <label className="form-label">Deck</label>
            <select
              className="form-select"
              value={form.deckId || selectedDeck}
              onChange={e => setForm(f => ({ ...f, deckId: e.target.value }))}
            >
              {decks.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Word (front) */}
          <div className="form-group">
            <label className="form-label">Word (Front)</label>
            <div className="input-row">
              <input
                className="text-input"
                placeholder="e.g. ephemeral"
                value={form.front}
                onChange={e => setForm(f => ({ ...f, front: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && lookupDefinition()}
              />
              <button
                className="lookup-btn"
                onClick={lookupDefinition}
                disabled={looking || !form.front.trim()}
              >
                {looking ? '...' : '🔍'}
              </button>
            </div>
          </div>

          {/* Definition (back) */}
          <div className="form-group">
            <label className="form-label">Definition (Back)</label>
            <textarea
              className="text-input textarea"
              placeholder="Meaning or translation..."
              value={form.back}
              onChange={e => setForm(f => ({ ...f, back: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Example */}
          <div className="form-group">
            <label className="form-label">Example sentence <span className="optional">(optional)</span></label>
            <textarea
              className="text-input textarea"
              placeholder="e.g. The ephemeral beauty of cherry blossoms..."
              value={form.example}
              onChange={e => setForm(f => ({ ...f, example: e.target.value }))}
              rows={2}
            />
          </div>

          {error && <p className="error-msg">⚠️ {error}</p>}
          {saved && <p className="success-msg">✓ Card saved!</p>}

          <button className="save-btn" onClick={handleSave}>
            Save Card
          </button>
        </div>
      )}
    </div>
  );
}

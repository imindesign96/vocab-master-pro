import { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from './firebase/config';
import { subscribeToDecks, subscribeToCards } from './firebase/cardService';

import { DEFAULT_NEW_PER_DAY } from './utils/srsEngine';
import BottomNav from './components/BottomNav';
import TodayScreen from './screens/TodayScreen';
import DecksScreen from './screens/DecksScreen';
import AddScreen from './screens/AddScreen';
import StatsScreen from './screens/StatsScreen';
import ReviewScreen from './screens/ReviewScreen';

export default function AnkiApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [reviewing, setReviewing] = useState(false);
  const [newPerDay, setNewPerDay] = useState(
    () => Number(localStorage.getItem('flashanki_new_per_day') || DEFAULT_NEW_PER_DAY)
  );
  const handleNewPerDayChange = useCallback((v) => {
    setNewPerDay(v);
    localStorage.setItem('flashanki_new_per_day', v);
  }, []);

  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);

  // Auth
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);
  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
  const handleSignOut = () => signOut(auth);

  // Real-time Firestore
  useEffect(() => {
    if (!user) { setDecks([]); setCards([]); return; }
    const unsubDecks = subscribeToDecks(user.uid, setDecks);
    const unsubCards = subscribeToCards(user.uid, null, setCards);
    return () => { unsubDecks(); unsubCards(); };
  }, [user]);

  const handleCardUpdated = useCallback((updated) => {
    setCards(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  }, []);

  // ── Loading ──────────────────────────────────────────
  if (authLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  // ── Auth screen ──────────────────────────────────────
  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-content">
          <div className="auth-logo">📚</div>
          <h1 className="auth-title">FlashAnki</h1>
          <p className="auth-sub">Smart vocabulary learning with Anki's algorithm</p>
          <button className="google-btn" onClick={signIn}>
            <GoogleIcon /> Continue with Google
          </button>
          <p className="auth-note">Cards sync automatically across all devices</p>
        </div>
      </div>
    );
  }

  // ── Review mode (fullscreen) ─────────────────────────
  if (reviewing) {
    return (
      <div className="app">
        <div className="review-topbar">
          <button className="back-btn" onClick={() => setReviewing(false)}>✕</button>
          <span className="review-topbar-title">Study Session</span>
          <span className="review-mode-label">⌨️ Type</span>
        </div>
        <ReviewScreen
          cards={cards}
          uid={user.uid}
          newPerDay={newPerDay}
          onDone={() => setReviewing(false)}
          onCardUpdated={handleCardUpdated}
        />
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────
  return (
    <div className="app">
      <div className="user-bar">
        <div className="user-info">
          <img src={user.photoURL} alt="" className="user-avatar" />
          <span className="user-name">{user.displayName?.split(' ')[0]}</span>
        </div>
        <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
      </div>

      <div className="screen-container">
        {tab === 'today' && (
          <TodayScreen
            cards={cards}
            decks={decks}
            newPerDay={newPerDay}
            onNewPerDayChange={handleNewPerDayChange}
            onStartReview={() => setReviewing(true)}
            onNavigate={setTab}
          />
        )}
        {tab === 'decks' && (
          <DecksScreen decks={decks} cards={cards} uid={user.uid} onUpdate={() => {}} />
        )}
        {tab === 'add' && (
          <AddScreen decks={decks} uid={user.uid} onCardAdded={() => {}} />
        )}
        {tab === 'stats' && (
          <StatsScreen cards={cards} />
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

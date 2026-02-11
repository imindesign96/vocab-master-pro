// VocabMaster Pro with Firebase Authentication
import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase/config';
import {
  subscribeToWords,
  subscribeToStats,
  saveWord,
  saveWords,
  saveStats,
  deleteWord,
  migrateLocalStorageToFirestore,
  deleteAllUserData,
  importTOEICWords
} from './firebase/firestoreService';
import VocabMasterPro from './VocabMasterPro';
import AuthScreen from './firebase/AuthScreen';

export default function VocabMasterProWithAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        console.log('✅ User signed in:', currentUser.email);
      } else {
        console.log('👋 User signed out');
      }
    });

    return () => unsubscribe();
  }, []);

  // Migrate localStorage data to Firestore (truly one-time, tracked in localStorage)
  useEffect(() => {
    if (user && !migrated) {
      const migrationKey = `vm_migrated_${user.uid}`;
      if (localStorage.getItem(migrationKey)) {
        setMigrated(true);
        return;
      }

      const migrate = async () => {
        const hasLocalData = localStorage.getItem('vm_words');
        if (hasLocalData) {
          console.log('🔄 Migrating localStorage → Firestore...');
          const result = await migrateLocalStorageToFirestore(user.uid);

          if (result.success) {
            console.log(`✅ Migrated ${result.migratedWords} words`);
            localStorage.removeItem('vm_words');
            localStorage.removeItem('vm_stats');
          } else {
            console.error('❌ Migration failed:', result.error);
          }
        }
        localStorage.setItem(migrationKey, 'true');
        setMigrated(true);
      };

      migrate();
    }
  }, [user, migrated]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('👋 Signed out');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Memoize Firestore service (MUST be before early returns - Rules of Hooks)
  const firestoreServiceMemo = useMemo(() => {
    if (!user) return null;
    return {
      saveWord: (word) => saveWord(user.uid, word),
      saveWords: (words) => saveWords(user.uid, words),
      saveStats: (stats) => saveStats(user.uid, stats),
      deleteWord: (wordId) => deleteWord(user.uid, wordId),
      subscribeToWords: (callback) => subscribeToWords(user.uid, callback),
      subscribeToStats: (callback) => subscribeToStats(user.uid, callback),
      deleteAllUserData: () => deleteAllUserData(user.uid),
      importTOEICWords: (toeicWords, lessonIds) => importTOEICWords(user.uid, toeicWords, lessonIds),
    };
  }, [user?.uid]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e8e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Loading VocabMaster Pro...</div>
        </div>
      </div>
    );
  }

  // Not signed in - show auth screen
  if (!user) {
    return <AuthScreen onAuthSuccess={(user) => setUser(user)} />;
  }

  // Signed in - show main app with Firestore integration
  return (
    <VocabMasterPro
      userId={user.uid}
      userEmail={user.email}
      userPhoto={user.photoURL}
      onSignOut={handleSignOut}
      firestoreService={firestoreServiceMemo}
    />
  );
}

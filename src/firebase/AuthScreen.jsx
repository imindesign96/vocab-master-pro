// Authentication Screen with Google Sign-in
import { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './config';

const THEME = {
  bg: "#0a0a0f",
  card: "#1a1a24",
  accent: "#6c5ce7",
  text: "#e8e8f0",
  textSecondary: "#9b9baf",
  gradient1: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
  success: "#00d2a0",
};

export default function AuthScreen({ onAuthSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log('✅ Signed in:', user.email);

      // Notify parent component
      if (onAuthSuccess) {
        onAuthSuccess(user);
      }
    } catch (error) {
      console.error('❌ Sign-in error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: 420,
        width: '100%',
        animation: 'vmFadeIn 0.5s ease'
      }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: THEME.text, marginBottom: 8 }}>
            VocabMaster Pro
          </div>
          <div style={{ fontSize: 15, color: THEME.textSecondary }}>
            Master English vocabulary with AI-powered spaced repetition
          </div>
        </div>

        {/* Sign-in Card */}
        <div style={{
          background: THEME.card,
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: THEME.text, marginBottom: 8 }}>
            Welcome Back
          </div>
          <div style={{ fontSize: 14, color: THEME.textSecondary, marginBottom: 24 }}>
            Sign in to sync your vocabulary across devices
          </div>

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: 14,
              border: 'none',
              background: '#fff',
              color: '#3c4043',
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => !loading && (e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
            onMouseOut={(e) => !loading && (e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
          >
            {loading ? (
              <div style={{ fontSize: 14 }}>Signing in...</div>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z" fill="#4285F4"/>
                  <path d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z" fill="#34A853"/>
                  <path d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z" fill="#FBBC05"/>
                  <path d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: '#ff4757' + '15',
              border: '1px solid #ff4757' + '40',
              borderRadius: 10,
              color: '#ff4757',
              fontSize: 13
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Features */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #2a2a3a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textSecondary, marginBottom: 12 }}>
              ✨ With your account:
            </div>
            {[
              '☁️ Auto-sync across devices',
              '📊 Track your learning progress',
              '🔒 Secure cloud backup',
              '🎯 Personalized learning path'
            ].map((feature, i) => (
              <div key={i} style={{
                fontSize: 13,
                color: THEME.textSecondary,
                marginBottom: 8,
                paddingLeft: 4
              }}>
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 12,
          color: THEME.textSecondary
        }}>
          By signing in, you agree to our Terms & Privacy Policy
        </div>
      </div>
    </div>
  );
}

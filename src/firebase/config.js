// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// TODO: Replace this with your Firebase config from Firebase Console
// Settings → Project settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyBxT7DPFMD6q-cTYMgk_RPBTEVy0NYcBTo",
  authDomain: "vocab-master-pro-2b556.firebaseapp.com",
  projectId: "vocab-master-pro-2b556",
  storageBucket: "vocab-master-pro-2b556.firebasestorage.app",
  messagingSenderId: "199508173635",
  appId: "1:199508173635:web:82f9b1431c5a9e78cac5f6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

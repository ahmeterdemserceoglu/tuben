import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBurs7S4771dy2-r17J_DmOGTD3aAffhvI",
  authDomain: "tuben-df76e.firebaseapp.com",
  projectId: "tuben-df76e",
  storageBucket: "tuben-df76e.firebasestorage.app",
  messagingSenderId: "19865337299",
  appId: "1:19865337299:web:3528e6ef55e8c28fd6c326",
  measurementId: "G-HVVP67FY0S"
};

export const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('YOUR_API_KEY') &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes('tuben-app')
  );
};

let app: any = null;
let auth: any = null;
let db: any = null;

try {
  if (isFirebaseConfigured()) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.warn('Firebase init error:', error);
}

export { app, auth, db };

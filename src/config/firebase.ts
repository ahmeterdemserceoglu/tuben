import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBurs7S4771dy2-r17J_DmOGTD3aAffhvI",
  authDomain: "tuben-df76e.firebaseapp.com",
  projectId: "tuben-df76e",
  storageBucket: "tuben-df76e.firebasestorage.app",
  messagingSenderId: "19865337299",
  appId: "1:19865337299:web:3528e6ef55e8c28fd6c326",
  measurementId: "G-HVVP67FY0S",
  databaseURL: "https://tuben-df76e-default-rtdb.firebaseio.com"
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('YOUR_API_KEY') &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes('tuben-app')
  );
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function initAuth(): Auth {
  try {
    if (Platform.OS === 'web') {
      return getAuth(app);
    }

    const authModule = require('firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };

    if (authModule.getReactNativePersistence) {
      try {
        return initializeAuth(app, {
          persistence: authModule.getReactNativePersistence(AsyncStorage),
        });
      } catch (error: any) {
        if (error?.code === 'auth/already-initialized') {
          return getAuth(app);
        }
      }
    }
    return getAuth(app);
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = initAuth();
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);

export { app };

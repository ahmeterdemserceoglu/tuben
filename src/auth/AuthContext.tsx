import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, remove } from 'firebase/database';
import { auth, db, rtdb } from '../config/firebase';
import { AppUser } from '../types/user';
import { PresenceService } from '../services/presenceService';

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            setUser({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: data.displayName || fbUser.displayName || 'Tuben Kullanıcısı',
              photoURL: data.photoURL || fbUser.photoURL,
              createdAt: data.createdAt?.toMillis?.() || Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
            });
          } else {
            // First time creation in Firestore
            const newUser: any = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || (fbUser.isAnonymous ? 'Misafir Kullanıcı' : 'Tuben Kullanıcısı'),
              photoURL: fbUser.photoURL || null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              schemaVersion: 1,
            };
            await setDoc(userDocRef, newUser, { merge: true });
            setUser({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: newUser.displayName,
              photoURL: newUser.photoURL,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        } catch (e) {
          console.warn('[Auth] Error syncing Firestore user profile:', e);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || 'Tuben Kullanıcısı',
            photoURL: fbUser.photoURL,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const translateAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Geçersiz e-posta adresi biçimi.';
      case 'auth/user-not-found':
        return 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Hatalı e-posta veya şifre girdiniz.';
      case 'auth/email-already-in-use':
        return 'Bu e-posta adresi zaten başka bir hesapta kayıtlı.';
      case 'auth/weak-password':
        return 'Şifreniz çok zayıf. En az 6 karakter giriniz.';
      case 'auth/network-request-failed':
        return 'İnternet bağlantınızı kontrol edip tekrar deneyin.';
      default:
        return err?.message || 'Giriş işlemi sırasında bir hata oluştu.';
    }
  };

  const signIn = async (email: string, pass: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (err: any) {
      const msg = translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInGuest = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      const msg = translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      const msg = translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const deleteAccount = async () => {
    setError(null);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      const msg = 'Silinecek etkin bir hesap bulunamadı.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      const uid = currentUser.uid;
      const childCollections = ['favorites', 'history', 'subscriptions', 'playlists'];

      PresenceService.stopPresence();
      await Promise.all(
        childCollections.map(async (collectionName) => {
          const snapshot = await getDocs(collection(db, 'users', uid, collectionName));
          await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
        }),
      );
      await Promise.all([
        deleteDoc(doc(db, 'users', uid)),
        remove(ref(rtdb, `/presence/${uid}`)),
      ]);
      await deleteUser(currentUser);
    } catch (err: any) {
      const msg = err?.code === 'auth/requires-recent-login'
        ? 'Güvenlik için yeniden giriş yapıp hesap silme işlemini tekrar deneyin.'
        : translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = translateAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isAnonymous: Boolean(firebaseUser?.isAnonymous),
        signIn,
        signUp,
        signInGuest,
        signOut,
        deleteAccount,
        resetPassword,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

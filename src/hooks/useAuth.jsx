import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
            setLoading(false);
          } else {
            console.log("No profile found for UID:", user.uid, "initializing...");
            
            // Basic profile shell
            const baseProfile = {
              uid: user.uid,
              displayName: user.displayName || 'User',
              email: user.email || '',
              photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`,
              role: 'member',
              orgId: null,
              orgName: null,
              createdAt: serverTimestamp(),
            };

            try {
              // Standard new user creation
              console.log("Creating new profile doc...");
              await setDoc(docRef, baseProfile);
              setProfile(baseProfile);
              console.log("Profile created successfully.");
            } catch (err) {
              console.error("Critical error during profile creation:", err);
              // Handle permission denied specially
              if (err.code === 'permission-denied') {
                console.warn("Permission denied. Check if rules are deployed and schema is valid.");
              }
            }
            setLoading(false);
          }
        }, (error) => {
          console.error("Profile snapshot error:", error);
          // Don't crash the whole app, but log it
          if (error.code !== 'permission-denied') {
             handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const logOut = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

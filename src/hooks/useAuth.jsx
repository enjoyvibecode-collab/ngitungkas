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
            console.log("No profile found for UID, checking for manual registration by email:", user.email);
            
              let baseProfile = {
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
                const { getDocs, query, collection, where, writeBatch } = await import('firebase/firestore');
                
                const q = query(
                  collection(db, 'users'), 
                  where('email', '==', user.email), 
                  where('isManualCreated', '==', true)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const manualDoc = querySnapshot.docs[0];
                  const manualData = manualDoc.data();
                  
                  baseProfile = {
                    ...baseProfile,
                    ...manualData,
                    uid: user.uid,
                    isManualCreated: false,
                    claimedAt: serverTimestamp()
                  };

                  const batch = writeBatch(db);
                  batch.set(docRef, baseProfile);
                  batch.delete(manualDoc.ref);
                  await batch.commit();
                } else {
                  await setDoc(docRef, baseProfile);
                }
              } catch (err) {
                console.error("Error during profile linking, setting default:", err);
                // Try simple creation if batch/query failed
                try { await setDoc(docRef, baseProfile); } catch(e) {}
              } finally {
                setProfile(baseProfile);
                setLoading(false);
              }
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

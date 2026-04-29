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
          } else {
            console.log("No profile found by UID, checking for manual registration by email:", user.email);
            
            // Check if there is a manual record for this email
            try {
              let baseProfile = {
                uid: user.uid,
                displayName: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`,
                role: 'member',
                orgId: null,
                createdAt: serverTimestamp(),
              };

              try {
                const { getDocs, query, collection, where, writeBatch } = await import('firebase/firestore');
                const q = query(collection(db, 'users'), where('email', '==', user.email), where('isManualCreated', '==', true));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  // We found a manual account!
                  const manualDoc = querySnapshot.docs[0];
                  const manualData = manualDoc.data();
                  console.log("Found manual account, merging data...");
                  
                  baseProfile = {
                    ...baseProfile,
                    ...manualData,
                    uid: user.uid, // ensure UID is correct
                    isManualCreated: false, // mark as claimed
                    claimedAt: serverTimestamp()
                  };

                  // Delete the manual doc to clean up
                  const batch = writeBatch(db);
                  batch.set(docRef, baseProfile);
                  batch.delete(manualDoc.ref);
                  await batch.commit();
                } else {
                  // Standard new user
                  await setDoc(docRef, baseProfile);
                }
              } catch (err) {
                console.error("Error during profile linking, falling back to standard profile:", err);
                // Even if linking fails, ensure user has a profile doc
                await setDoc(docRef, baseProfile);
              }
              setProfile(baseProfile);
            } catch (err) {
              console.error("Error during profile linking:", err);
            }
          }
          setLoading(false);
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

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
            
            try {
              const { getDocs, query, collection, where, writeBatch } = await import('firebase/firestore');
              
              // Cek apakah ada akun manual (isManualCreated: true) dengan email yang sama
              const q = query(
                collection(db, 'users'), 
                where('email', '==', user.email), 
                where('isManualCreated', '==', true)
              );
              const querySnapshot = await getDocs(q);
              
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

              if (!querySnapshot.empty) {
                // Ditemukan akun manual! Kita ambil datanya
                const manualDoc = querySnapshot.docs[0];
                const manualData = manualDoc.data();
                console.log("Found manual account, merging data...");
                
                baseProfile = {
                  ...baseProfile,
                  ...manualData,
                  uid: user.uid, // Pastikan UID tetap pakai yang dari Google Auth
                  isManualCreated: false, // Tandai sebagai sudah diklaim
                  claimedAt: serverTimestamp()
                };

                // Gunakan Batch untuk memindahkan data (Buat di dokumen UID, hapus dokumen manual)
                const batch = writeBatch(db);
                batch.set(docRef, baseProfile);
                batch.delete(manualDoc.ref);
                await batch.commit();
                console.log("Manual account linked successfully.");
              } else {
                // Tidak ada akun manual, buat akun member biasa
                await setDoc(docRef, baseProfile);
              }
              
              setProfile(baseProfile);
            } catch (err) {
              console.error("Error during profile linking:", err);
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

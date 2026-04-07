// src/services/logger.ts
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

export type LogType = 'meal' | 'workout' | 'progress' | 'weight';

// Helper: Generate Date Key (YYYY-MM-DD)
export const getDateKey = (date: Date = new Date()) => date.toISOString().split('T')[0];

/**
 * Save User Log (Unified Function)
 * - Jika dateKey ada: Menggunakan setDoc (merge) -> Cocok untuk Daily Log/Summary
 * - Jika dateKey kosong: Menggunakan addDoc (append) -> Cocok untuk Weight History / Individual Events
 */
export const saveUserLog = async (type: LogType, payload: any, dateKey?: string, idSuffix?: string) => {
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!db) throw new Error("Firestore DB not initialized");
  const uid = auth.currentUser.uid;
  const collectionName = `${type}_logs`;

  try {
    if (dateKey) {
      // Daily Log (Upsert/Merge) -> ID: uid_date
      const docId = idSuffix ? `${uid}_${dateKey}_${idSuffix}` : `${uid}_${dateKey}`;
      const docRef = doc(db, collectionName, docId);
      
      await setDoc(docRef, {
        userId: uid,
        date: dateKey,
        ...payload,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      return docId;
    } else {
      // Individual Entry (Append) -> ID: Auto
      const colRef = collection(db, collectionName);
      const docRef = await addDoc(colRef, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    }
  } catch (error) {
    console.error(`Error saving ${type} log:`, error);
    throw error;
  }
};

/**
 * Fetch Single Daily Log
 */
export const fetchUserLogByDate = async (type: LogType, dateKey: string) => {
  if (!auth.currentUser) return null;
  if (!db) return null;
  const uid = auth.currentUser.uid;
  const collectionName = `${type}_logs`;
  const docId = `${uid}_${dateKey}`;
  
  try {
    const docRef = doc(db, collectionName, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (error) {
    console.error(`Error fetching ${type} log:`, error);
    return null;
  }
};

/**
 * Fetch Logs List (e.g. History)
 */
export const fetchUserLogs = async (type: LogType, limitVal = 7) => {
  if (!auth.currentUser) return [];
  if (!db) return [];
  const uid = auth.currentUser.uid;
  const collectionName = `${type}_logs`;

  try {
    const q = query(
      collection(db, collectionName),
      where("userId", "==", uid),
      orderBy("date", "desc")
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching ${type} logs:`, error);
    return [];
  }
};

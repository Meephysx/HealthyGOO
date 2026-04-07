// src/services/firestore.ts
import { db } from "../firebase";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";


/* ===============================
   USER LOGS
================================ */

export async function getUserProfile(uid: string) {
  if (!db) return null;
  const docRef = doc(db, "users", uid);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

export async function createUserProfile(uid: string, data: any) {
  // Menggunakan setDoc agar ID dokumen sama dengan UID user (Authentication)
  // Ini mencegah error "first argument to collection() must be..." jika db tidak ter-pass dengan benar di component
  if (!db) throw new Error("Firestore not initialized");
  return await setDoc(doc(db, "users", uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* ===============================
   PROGRESS LOGS (HealthyGo)
================================ */

export async function saveProgressLog(uid: string, payload: any) {
  if (!db) throw new Error("Firestore not initialized");
  return await addDoc(collection(db, "progress_logs"), {
    userId: uid,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function fetchProgressLogs(uid: string) {
  if (!db) return [];
  const q = query(
    collection(db, "progress_logs"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/* ===============================
   MEAL LOGS
================================ */

export async function saveMealLog(uid: string, payload: any) {
  if (!db) throw new Error("Firestore not initialized");
  return await addDoc(collection(db, "meal_logs"), {
    userId: uid,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/* ===============================
   WORKOUT LOGS
================================ */

export async function saveWorkoutLog(uid: string, payload: any) {
  if (!db) throw new Error("Firestore not initialized");
  return await addDoc(collection(db, "workout_logs"), {
    userId: uid,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/* =================================================================
   AI CHAT (Firestore)
================================================================= */

// Create/get the chat session document
export const getOrCreateChatSession = async (userId: string) => {
  if (!db) throw new Error("Firestore not initialized");
  const chatDocRef = doc(db, "chats", `${userId}_ai`);
  const chatDocSnap = await getDoc(chatDocRef);

  if (chatDocSnap.exists()) {
    return chatDocRef;
  } else {
    await setDoc(chatDocRef, {
      userId: userId,
      type: "ai",
      createdAt: serverTimestamp(),
      lastMessage: "Chat session started.",
    });
    return chatDocRef;
  }
};

// Add a new message to the subcollection and update the parent doc
export const addChatMessage = async (
  chatId: string,
  message: { sender: "user" | "ai"; text: string }
) => {
  if (!db) throw new Error("Firestore not initialized");

  // 1. Add message to subcollection
  const messagesColRef = collection(db, "chats", chatId, "messages");
  await addDoc(messagesColRef, {
    ...message,
    timestamp: serverTimestamp(),
  });

  // 2. Update lastMessage on the parent chat document
  const chatDocRef = doc(db, "chats", chatId);
  await updateDoc(chatDocRef, {
    lastMessage: message.text,
    updatedAt: serverTimestamp(),
  });
};

// Listen to real-time messages
export const getChatMessages = (
  chatId: string,
  callback: (messages: any[]) => void
) => {
  if (!db) throw new Error("Firestore not initialized");
  const messagesColRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesColRef, orderBy("timestamp", "asc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });

  return unsubscribe; // Return the unsubscribe function to be called on cleanup
};

// src/services/chatService.ts
import { db } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  getDocs,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';

// --- TYPE DEFINITIONS ---

/**
 * Represents the metadata for a chat room in the 'chats' collection.
 */
export interface Chat {
  id: string;
  type: 'ai' | 'trainer';
  participants: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
}

/**
 * Represents a single message within a chat room's 'messages' subcollection.
 */
export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;
}

// --- SERVICE FUNCTIONS ---

/**
 * Creates or gets a chat session with the AI for a specific user.
 * The chat ID is deterministic to ensure only one chat room exists per user-AI pair.
 * @param uid The user's ID.
 * @returns The ID of the chat room.
 */
export async function createAIChat(uid: string): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');
  const chatId = `${uid}_ai`;
  const chatRef = doc(db, 'chats', chatId);

  try {
    // Use setDoc with merge:true to create if not exists, or do nothing if it does.
    // This is an idempotent operation.
    await setDoc(
      chatRef,
      {
        type: 'ai',
        participants: [uid, 'ai'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return chatId;
  } catch (error) {
    console.error('Error creating AI chat:', error);
    throw error;
  }
}

/**
 * Creates or gets a chat session between a user and a trainer.
 * The chat ID is deterministic to ensure only one chat room exists per user-trainer pair.
 * @param uid The user's ID.
 * @param trainerId The trainer's ID.
 * @returns The ID of the chat room.
 */
export async function createTrainerChat(
  uid: string,
  trainerId: string
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  // Sort UIDs to create a consistent, predictable chat ID for any pair.
  const participants = [uid, trainerId].sort();
  const chatId = participants.join('_');
  const chatRef = doc(db, 'chats', chatId);

  try {
    await setDoc(
      chatRef,
      {
        type: 'trainer',
        participants: participants,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return chatId;
  } catch (error) {
    console.error('Error creating trainer chat:', error);
    throw error;
  }
}

/**
 * Sends a message to a specific chat room and atomically updates the chat's metadata.
 * @param chatId The ID of the chat room.
 * @param senderId The ID of the message sender (user's UID, trainer's UID, or the string "ai").
 * @param text The content of the message.
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  if (!text.trim()) return; // Don't send empty messages

  const chatRef = doc(db, 'chats', chatId);
  const messagesColRef = collection(chatRef, 'messages');
  const newMessageRef = doc(messagesColRef); // Create a ref with a new auto-generated ID

  const batch = writeBatch(db);

  // 1. Add the new message to the 'messages' subcollection
  batch.set(newMessageRef, {
    senderId: senderId,
    text: text,
    timestamp: serverTimestamp(),
  });

  // 2. Update the parent chat document with the last message and timestamp
  batch.update(chatRef, {
    lastMessage: {
      text: text,
      senderId: senderId,
    },
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Listens for real-time messages in a chat room.
 * @param chatId The ID of the chat room.
 * @param callback A function to be called with the array of messages whenever there's an update.
 * @returns An unsubscribe function to stop listening to updates.
 */
export function listenMessages(
  chatId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  if (!db) throw new Error('Firestore not initialized');

  const messagesColRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesColRef, orderBy('timestamp', 'asc'));

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const messages = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Message)
      );
      callback(messages);
    },
    (error) => {
      console.error('Error listening to messages:', error);
    }
  );

  return unsubscribe;
}

/**
 * Fetches the list of chats for a given user, ordered by the most recent activity.
 * @param uid The user's ID.
 * @returns A promise that resolves to an array of chat objects.
 */
export async function fetchChatList(uid: string): Promise<Chat[]> {
  if (!db) throw new Error('Firestore not initialized');

  const chatsColRef = collection(db, 'chats');
  const q = query(
    chatsColRef,
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Chat));
  } catch (error) {
    console.error('Error fetching chat list:', error);
    throw error;
  }
}
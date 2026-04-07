import { initializeApp, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDYtJr4DzOHD9eZiVAWLJo3A9WCyrOMNxg",
  authDomain: "healthygo-c4920.firebaseapp.com",
  projectId: "healthygo-c4920",
  storageBucket: "healthygo-c4920.firebasestorage.app",
  messagingSenderId: "1088712734464",
  appId: "1:1088712734464:web:cf949690becb4916d565e5",
};

// Initialize Firebase
let app: FirebaseApp;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

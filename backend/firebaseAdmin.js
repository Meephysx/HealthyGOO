const admin = require("firebase-admin");
require("dotenv").config();

// 🔥 Ambil dari ENV, bukan file
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
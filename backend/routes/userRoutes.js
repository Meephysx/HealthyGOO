const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebaseAdmin");
const verifyUser = require("../middleware/authMiddleware");

// =========================
// REGISTER USER
// =========================
router.post("/register", async (req, res) => {
  try {
    const { fullname, idToken } = req.body;

    if (!fullname || !idToken) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    // Verifikasi ID Token Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Cek apakah user sudah ada di Firestore
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      return res.status(400).json({ message: "User sudah terdaftar" });
    }

    const newUser = {
      fullname,
      name: fullname,
      email: decodedToken.email,
      createdAt: new Date().toISOString(),
      profileCompleted: false,
      allergies: [],
      preferences: [],
      dislikes: []
    };

    await userRef.set(newUser);

    return res.status(201).json({ message: "Registrasi berhasil", user: { ...newUser, uid } });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server", detail: error.message });
  }
});

// =========================
// LOGIN USER
// =========================
router.post("/login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "ID Token wajib dikirim" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const userData = userSnap.data();
    return res.status(200).json({ message: "Login berhasil", user: { ...userData, uid } });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server", detail: error.message });
  }
});

// =========================
// UPDATE PROFILE
// =========================
router.post("/update-profile", verifyUser, async (req, res) => {
  try {
    const uid = req.user ? req.user.uid : null;

    if (!uid) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    // Simpan ke Firestore
    await db.collection("users").doc(uid).set({
      ...data,
      updatedAt: new Date().toISOString(),
      profileCompleted: true,
    }, { merge: true });

    res.json({ message: "Profile updated", user: { uid, ...data } });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});



// =========================
// GET USER BY UID
// =========================
router.get("/:uid", verifyUser, async (req, res) => {
  try {
    const { uid } = req.params;

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (!userData) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ user: userData });

  } catch (error) {
    console.error("GET USER ERROR:", error);
    res.status(500).json({ message: "Server error", detail: error.message });
  }
});

module.exports = router;

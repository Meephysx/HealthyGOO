// middleware/authMiddleware.js
const admin = require("../firebaseAdmin");

const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: Token diperlukan" });
    }

    const idToken = authHeader.split(" ")[1];

    // Verifikasi ID Token (bukan custom token)
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Simpan UID untuk route
    req.uid = decoded.uid;

    next();

  } catch (error) {
    console.error("AUTH ERROR:", error);
    return res.status(401).json({
      message: "Token tidak valid atau kedaluwarsa",
      error: error.message,
    });
  }
};

module.exports = verifyUser;

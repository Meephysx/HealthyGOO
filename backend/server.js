require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 🔥 ERROR HANDLER (biar keliatan di Railway)
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[ERROR] Unhandled Rejection:', err);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Debug request masuk
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});


// =========================
// ✅ ROOT TEST (WAJIB)
// =========================
app.get('/', (req, res) => {
  res.send('SERVER HIDUP 🔥');
});


// =========================
// ❌ BLOK SEMENTARA (BIAR GAK CRASH)
// =========================

// Firebase & user routes (sering bikin error)
// const userRoutes = require('./routes/userRoutes');
// app.use('/api/users', userRoutes);

// Frontend dist (belum ada di Railway)
// const path = require('path');
// const distPath = path.join(__dirname, '../dist');
// app.use(express.static(distPath));

// app.get(/(.*)/, (req, res) => {
//   if (req.path.startsWith('/api')) {
//     return res.status(404).json({ message: 'API endpoint not found' });
//   }
//   res.sendFile(path.join(distPath, 'index.html'));
// });


// =========================
// ⚠️ OPTIONAL: AI ROUTE (kalau mau test nanti)
// =========================
try {
  const aiRoutes = require('./routes/aiRoutes');
  app.use('/api/ai-chat', aiRoutes);
  console.log('[backend] aiRoutes loaded');
} catch (e) {
  console.log('[backend] aiRoutes gagal load:', e.message);
}


// =========================
// 404 HANDLER
// =========================
app.use((req, res) => {
  res.status(404).json({ message: 'Route tidak ditemukan' });
});


// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT}`);
  console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'ADA' : 'KOSONG');
});
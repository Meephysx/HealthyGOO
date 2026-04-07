require('dotenv').config();
const path = require('path');

// Global error handlers to help debug unexpected exits
process.on('uncaughtException', (err) => {
  console.error('[backend] Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('[backend] Unhandled Rejection at:', p, 'reason:', reason && reason.stack ? reason.stack : reason);
});

// NOTE: This file is a local development server using Express. In Vercel/production, prefer the serverless handler at `/api/ai-chat.js` (no Express required).
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware Logging: Cek apakah request dari HP masuk
app.use((req, res, next) => {
  console.log(`[backend] Request masuk: ${req.method} ${req.url} | IP: ${req.ip}`);
  next();
});

app.use('/api/users', userRoutes);
app.use('/api/ai-chat', aiRoutes);
console.log('[backend] Mounted aiRoutes at /api/ai-chat');
console.log('[backend] GROQ_API_KEY configured:', !!process.env.GROQ_API_KEY);

// --- KONFIGURASI DEPLOYMENT ---
// Menyajikan file statis dari folder build frontend (dist)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all handler: Segala request yang bukan API akan diarahkan ke index.html (SPA)
app.get(/(.*)/, (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server berjalan di port ${PORT} (0.0.0.0) - Siap diakses dari HP`));
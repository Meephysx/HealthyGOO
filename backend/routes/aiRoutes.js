// backend/routes/aiRoutes.js
// VERSION: ULTIMATE STABLE (Groq + Llama3 + Dual Parsers + Offline Fallback)

const express = require('express');
const router = express.Router();

console.log('[backend] aiRoutes (Ultimate Version) module loaded');

// --- KONFIGURASI ---
const DEFAULT_MODEL = 'llama-3.1-8b-instant'; // Model Cepat & Pintar
const MAX_TOKENS = 4096; // WAJIB BESAR agar rencana diet/gym tidak terpotong
const TEMPERATURE = 0.6; // Sedikit lebih rendah agar output konsisten
const TIMEOUT_MS = 25000; // 25 Detik timeout (aman untuk jawaban panjang)

// --- INISIALISASI GROQ ---
let groqClient = null;
try {
  const Groq = require('groq-sdk');
  const apiKey = process.env.GROQ_API_KEY;
  
  if (apiKey) {
    groqClient = new Groq({ apiKey: apiKey });
    console.log('[backend] Groq SDK status: READY');
  } else {
    console.warn('[backend] WARNING: GROQ_API_KEY is missing in .env');
  }
} catch (e) {
  console.warn('[backend] Failed to load groq-sdk:', e.message);
}

// --- SYSTEM PROMPTS (Instruksi Rahasia ke AI) ---
const SYSTEM_PROMPTS = {
  nutrition: `You are a professional Nutritionist. 
  If asked for a meal plan, provide a structured list for: Breakfast (Sarapan), Lunch (Makan Siang), Dinner (Makan Malam), and Snacks.
  Ensure the TOTAL daily calories and macros meet the user's specific needs. If a meal is low in protein, include side dishes (like tempeh, tofu, eggs) to balance it.
  
  CRITICAL SAFETY RULE: You MUST strictly adhere to the user's allergies and dietary restrictions. NEVER suggest food containing allergens specified by the user. Check for hidden ingredients (e.g., peanuts in sauces, shrimp paste in sambal).
  
  For each item, explicitly mention the Menu Name, Calories (kcal), Protein (g), Carbs (g), and Fat (g).
  If the user requests JSON, provide ONLY JSON. Otherwise, format the output clearly using bullet points. Use Indonesian language.`,
  
  exercise: `You are a professional Fitness Trainer.
  If asked for a workout plan, provide a list of exercises.
  For each exercise, mention the Name, Sets, Reps, and estimated calories burned.
  Format output clearly. Use Indonesian language.`,
  
  general: `You are a helpful health assistant. Answer in Indonesian. be concise and helpful.`
};

// --- HELPER FUNCTIONS ---

function generatePersonalizedPrompt(basePrompt, userProfile) {
  if (!userProfile) return basePrompt;

  let profileSummary = `You are a personal AI Coach for a user with the following profile:\n`;
  if (userProfile.gender) profileSummary += `- Gender: ${userProfile.gender}\n`;
  if (userProfile.age) profileSummary += `- Age: ${userProfile.age} years\n`;
  if (userProfile.weight) profileSummary += `- Weight: ${userProfile.weight} kg\n`;
  if (userProfile.height) profileSummary += `- Height: ${userProfile.height} cm\n`;
  if (userProfile.goal) profileSummary += `- Primary Goal: ${userProfile.goal}\n`;
  if (userProfile.activityLevel) profileSummary += `- Activity Level: ${userProfile.activityLevel}\n`;

  profileSummary += `\nAlways tailor your advice to this user's specific profile and goal. Be their supportive and knowledgeable partner in achieving their health objectives.\n\n---\n\n`;

  return profileSummary + basePrompt;
}


function extractLastUserMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && m.content) return m.content;
  }
  return '';
}

function classifyTopic(text) {
  if (!text) return 'other';
  const t = text.toLowerCase();
  if (/\b(kalori|diet|makan|food|nutrition|nutrisi|gizi|protein|karbo|lemak|menu|resep|sarapan|siang|malam)\b/.test(t)) return 'nutrition';
  if (/\b(olahraga|workout|gym|lari|fitness|latihan|otot|cardio|push up|squat|plan|jadwal)\b/.test(t)) return 'exercise';
  return 'other';
}

// --- PARSERS (Mengubah Teks AI menjadi Data JSON untuk Frontend) ---

// 1. Parser Meal Plan
function parseMealTextToPlan(text) {
  if (!text || typeof text !== 'string') return null;

  // --- DEBUG: Log Raw Text ---
  console.log('[backend] Raw AI Reply (Meal):', text);

  // --- JSON PARSING (Prioritas) ---
  try {
    // Cari blok JSON (dimulai { atau [) dan ambil sampai akhir blok
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[backend] JSON Meal Plan parsed successfully');
      return parsed;
    }
  } catch (e) {
    console.warn('[backend] JSON parsing failed, falling back to text regex:', e.message);
  }

  // Regex untuk menangkap section (Fallback jika JSON gagal)
  const labels = ['Sarapan', 'Makan\\s*Siang', 'Makan\\s*Malam', 'Snack', 'Camilan'];
  const labelPattern = labels.join('|');
  const sectionRegex = new RegExp(`(?:\\*{0,2}\\s*)?(${labelPattern})(?:\\*{0,2}\\s*)([\\s\\S]*?)(?=(?:${labelPattern})|$)`, 'ig');

  const sections = {};
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    const rawLabel = match[1];
    const content = match[2].trim();
    
    // Normalisasi key
    let key = 'snacks';
    if (/sarapan/i.test(rawLabel)) key = 'Sarapan';
    else if (/siang/i.test(rawLabel)) key = 'MakanSiang';
    else if (/malam/i.test(rawLabel)) key = 'MakanMalam';

    // Ekstrak data
    let menu = content.split('\n')[0].replace(/^[:\-\*]+/, '').trim();
    const getNum = (regex) => { const m = content.match(regex); return m ? parseInt(m[1]) : 0; };

    sections[key] = { 
      menu: menu.substring(0, 50) || 'Menu Sehat', 
      calories: getNum(/(?:kalori|kcal)[:\s\-]*(\d+)/i),
      protein: getNum(/protein[:\s\-]*(\d+)/i),
      carbs: getNum(/(?:karbo|carb)[:\s\-]*(\d+)/i),
      fat: getNum(/(?:lemak|fat)[:\s\-]*(\d+)/i),
      portions: '1 Porsi', 
      time: key === 'Sarapan' ? '07:00' : key === 'MakanSiang' ? '13:00' : '19:00' 
    };
  }

  // Validasi minimal ada 2 waktu makan agar dianggap plan valid
  if (Object.keys(sections).length < 2) return null;

  return {
    Sarapan: sections.Sarapan || { menu: '-', calories: 0 },
    MakanSiang: sections.MakanSiang || { menu: '-', calories: 0 },
    MakanMalam: sections.MakanMalam || { menu: '-', calories: 0 },
    snacks: sections.snacks || { menu: '-', calories: 0 },
    totalCalories: (sections.Sarapan?.calories||0) + (sections.MakanSiang?.calories||0) + (sections.MakanMalam?.calories||0) + (sections.snacks?.calories||0)
  };
}

// 2. Parser Workout Plan
function parseWorkoutTextToPlan(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Cari baris yang mengandung repetisi (contoh: "3x10", "3 set", "10 reps")
  const exerciseLines = text.split('\n').filter(l => /\b(\d+x\d+|\d+\s*set|\d+\s*rep)\b/i.test(l));
  
  if (exerciseLines.length < 2) return null;

  const exercises = exerciseLines.slice(0, 8).map(line => {
    // Bersihkan karakter bullet point
    let cleanLine = line.replace(/^[\-\*\d\.]+\s*/, '').trim();
    
    // Pisahkan Nama Latihan dan Set/Reps
    const parts = cleanLine.split(/[:\-\(]/);
    const name = parts[0].trim();
    const sets = line.match(/(\d+x\d+)/) ? line.match(/(\d+x\d+)/)[1] : '3x10';
    
    return { 
      name: name, 
      sets: sets, 
      caloriesPerSet: 5 // Default estimate
    };
  });

  return {
    day: 'Rencana Latihan',
    focus: 'Full Body',
    duration: '45 Menit',
    intensity: 'Sedang',
    exercises: exercises
  };
}

// --- OFFLINE GENERATORS (Data Dummy jika Internet Mati) ---
function generateOfflineData(topic, prompt) {
  if (topic === 'nutrition') {
    return {
      reply: "Mode Offline: Berikut adalah contoh rencana makan seimbang.",
      structured_meal_plan: {
        Sarapan: { menu: 'Oatmeal Pisang Madu', calories: 350, protein: 12, carbs: 60, fat: 6, time: '07:00', portions: '4 sdm Oatmeal + 1 Pisang + 1 sdm Madu' },
        MakanSiang: { menu: 'Nasi Merah Ayam Bakar', calories: 500, protein: 40, carbs: 45, fat: 10, time: '12:30', portions: '100g Nasi Merah + 1 Dada Ayam + Lalapan' },
        MakanMalam: { menu: 'Ikan Kukus Sayur', calories: 300, protein: 25, carbs: 10, fat: 8, time: '19:00', portions: '1 Ekor Ikan (80g) + 1 Mangkuk Sayur' },
        snacks: { menu: 'Yoghurt Almond', calories: 150, protein: 8, carbs: 12, fat: 9, time: '16:00', portions: '1 cup Yoghurt + 5 butir Almond' },
        totalCalories: 1300
      }
    };
  } else if (topic === 'exercise') {
    return {
      reply: "Mode Offline: Berikut adalah latihan dasar di rumah.",
      structured_workout_plan: {
        day: 'Latihan Rumahan',
        focus: 'Kekuatan & Kardio',
        duration: '30 Menit',
        intensity: 'Pemula',
        exercises: [
          { name: 'Jumping Jacks', sets: '3x30 detik', caloriesPerSet: 15 },
          { name: 'Push Ups', sets: '3x10 reps', caloriesPerSet: 8 },
          { name: 'Squats', sets: '3x15 reps', caloriesPerSet: 10 },
          { name: 'Plank', sets: '3x30 detik', caloriesPerSet: 5 }
        ]
      }
    };
  }
  return { reply: "Maaf, saya sedang offline dan tidak dapat memproses permintaan spesifik ini. Silakan cek koneksi internet Anda." };
}

// --- FUNGSI UTAMA CALL GROQ ---
async function callGroq(messages, options = {}) {
  const { topic = 'general', userProfile } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    if (!groqClient) throw new Error('Groq Client not initialized');

    // Base system prompt based on topic
    let baseSystemPrompt = SYSTEM_PROMPTS.general;
    if (topic === 'nutrition') baseSystemPrompt = SYSTEM_PROMPTS.nutrition;
    if (topic === 'exercise') baseSystemPrompt = SYSTEM_PROMPTS.exercise;

    // Personalize the prompt if user profile is available
    const finalSystemInstruction = generatePersonalizedPrompt(baseSystemPrompt, userProfile);

    // Susun Pesan
    const finalMessages = [
      { role: "system", content: finalSystemInstruction },
      ...messages
    ];

    const completion = await groqClient.chat.completions.create({
      messages: finalMessages,
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }, { signal: controller.signal });

    clearTimeout(timeout);
    return completion.choices[0]?.message?.content || "";

  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// --- ROUTE HANDLER ---
async function aiHandler(req, res) {
  const { messages, userProfile } = req.body;
  
  // 1. Validasi Input
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages must be an array.' });
  }

  const userPrompt = extractLastUserMessage(messages);
  const topic = classifyTopic(userPrompt);

  console.log(`[backend] Request: "${userPrompt.substring(0,30)}..." | Topic: ${topic} | Has Profile: ${!!userProfile}`);

  // 2. Check for API key and Groq client availability
  if (!groqClient) {
    console.error('[backend] Groq Client not ready. Using Offline Fallback.');
    const offlineData = generateOfflineData(topic, userPrompt);
    return res.json({ ...offlineData, offline: true, model_used: 'offline-fallback' });
  }

  try {
    // 3. Panggil AI Groq with profile context
    const replyText = await callGroq(messages, { topic, userProfile });
    
    // 4. Proses Hasil (Parsing)
    let finalResponse = {
      reply: replyText,
      model_used: DEFAULT_MODEL,
      offline: false
    };

    // Jika topik Nutrition, coba parse Meal Plan
    if (topic === 'nutrition') {
      const plan = parseMealTextToPlan(replyText);
      if (plan) {
        finalResponse.structured_meal_plan = plan;
        console.log('[backend] Meal Plan Parsed Successfully');
      }
    }

    // Jika topik Exercise, coba parse Workout Plan
    if (topic === 'exercise') {
      const plan = parseWorkoutTextToPlan(replyText);
      if (plan) {
        finalResponse.structured_workout_plan = plan;
        console.log('[backend] Workout Plan Parsed Successfully');
      }
    }
    
    res.json(finalResponse);

  } catch (err) {
    console.error('[backend] API Error:', err.message);

    // 5. Emergency Fallback (Jika API Error/Timeout/Limit)
    const offlineData = generateOfflineData(topic, userPrompt);
    res.json({
      ...offlineData,
      error: err.message,
      model_used: 'offline-fallback',
      offline: true
    });
  }
}

// Routes
router.get('/', (req, res) => res.json({ status: 'AI Service Ready', model: DEFAULT_MODEL }));
router.post('/', aiHandler);

module.exports = router;
module.exports.handler = aiHandler;
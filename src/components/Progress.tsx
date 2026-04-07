import React, { useState, useEffect, useCallback } from 'react';
import { 
  Target, 
  Plus,
  Scale,
  TrendingUp,
  Utensils,     
  Flame,         
  Dumbbell,
  Activity,
  ChevronDown,
  PieChart,
  Heart,
  Zap,
  Calendar
} from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy
} from 'firebase/firestore';
import { useDailyLog } from '../context/DailyLogContext';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';

// --- TIPE DATA ---
interface User {
  id?: string;
  weight: number;
  height: number;
  age: number;
  gender: string;
  goal: string;
  idealWeight?: number;
  dailyCalories: number;
}

interface ProgressEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
}

interface DailyStats {
  date: string;
  caloriesIn: number;
  caloriesBurned: number;
  protein: number;
  carbs: number;
  fat: number;
  workoutCount: number;
  workoutFocus: string;
  netCalories: number;
}

const Progress: React.FC = () => {
  // --- STATE ---
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [user, setUser] = useState<User | null>(null);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ weight: '', notes: '' });
  
  const { userProfile, isLoading, addProgressEntry: contextAddProgress } = useDailyLog();

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Set user from profile context
  useEffect(() => {
    if (userProfile) {
      setUser(userProfile as unknown as User);
    }
  }, [userProfile]);

  // --- HELPER: FORMAT TANGGAL ---
  const getDateKey = (date: Date) => date.toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!authUser || !db) return;
    const uid = authUser.uid;

    // 1. Load Weight Logs (Progress Entries)
    try {
      const weightQ = query(
        collection(db, 'weight_logs'),
        where('userId', '==', uid),
        orderBy('date', 'asc')
      );
      const weightSnap = await getDocs(weightQ);
      const weights = weightSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProgressEntry));
      setProgressEntries(weights);
    } catch (e) { console.error("Error loading weight logs:", e); }

    // 2. Load Progress Data (Meals & Workouts) - Last 7 Days
    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);
      const dateStr = getDateKey(sevenDaysAgo);

      // Load Meal Logs
      const mealQ = query(
        collection(db, 'meal_logs'),
        where('userId', '==', uid),
        where('date', '>=', dateStr),
        orderBy('date', 'asc')
      );
      
      const mealSnap = await getDocs(mealQ);
      const mealLogs = mealSnap.docs.map(doc => doc.data());

      // Load Workout Logs
      const workoutQ = query(
        collection(db, 'workout_logs'),
        where('userId', '==', uid),
        where('date', '>=', dateStr),
        orderBy('date', 'asc')
      );
      
      const workoutSnap = await getDocs(workoutQ);
      const workoutLogs = workoutSnap.docs.map(doc => doc.data());

      // Grouping Data per Hari
      const statsMap = new Map<string, DailyStats>();
      
      // Inisialisasi 7 hari terakhir dengan nilai 0
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = getDateKey(d);
        statsMap.set(key, {
          date: key,
          caloriesIn: 0,
          caloriesBurned: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          workoutCount: 0,
          workoutFocus: '-',
          netCalories: 0
        });
      }

      // Isi data dari meal logs
      mealLogs.forEach((log: any) => {
        if (statsMap.has(log.date)) {
          const stat = statsMap.get(log.date)!;
          stat.caloriesIn = log.caloriesIn || log.totalCalories || 0;
          stat.protein = log.protein || 0;
          stat.carbs = log.carbs || 0;
          stat.fat = log.fat || 0;
        }
      });

      // Isi data dari workout logs
      workoutLogs.forEach((log: any) => {
        if (statsMap.has(log.date)) {
          const stat = statsMap.get(log.date)!;
          stat.caloriesBurned = log.totalCalories || log.caloriesBurned || 0;
          stat.workoutCount = log.exercises ? log.exercises.length : 0;
          stat.workoutFocus = log.workoutType || 'General';
        }
      });

      // Finalize net calories for all days in the stats map
      statsMap.forEach((stat) => {
        stat.netCalories = stat.caloriesIn - stat.caloriesBurned;
      });

      setWeeklyStats(Array.from(statsMap.values()));
    } catch (e) { console.error("Error loading progress logs:", e); }
  }, [authUser]);

  // --- EFFECT: LOAD DATA ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addProgressEntryHandler = async () => {
    if (!newEntry.weight) return;
    
    const weightVal = parseFloat(newEntry.weight);

    try {
      // Use context method to add progress entry
      await contextAddProgress(weightVal, newEntry.notes);

      // Optimistically update UI
      const todayKey = getDateKey(new Date());
      const entry: ProgressEntry = {
        id: `p-${Date.now()}`, // Temporary ID
        date: todayKey,
        weight: weightVal,
        notes: newEntry.notes
      };
      
      setProgressEntries(prevEntries => {
        const filtered = prevEntries.filter(p => p.date !== todayKey);
        return [...filtered, entry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });

      if (user) setUser({ ...user, weight: weightVal });

      setShowAddEntry(false);
      setNewEntry({ weight: '', notes: '' });

      // Re-fetch data to get the latest state from the server
      await fetchData();

    } catch (e) {
      console.error("Gagal menyimpan berat badan:", e);
      alert("Gagal menyimpan data. Cek koneksi internet.");
    }
  };

  // --- KALKULASI UNTUK UI ---
  const currentWeight = progressEntries.length > 0 
    ? progressEntries[progressEntries.length - 1].weight 
    : user?.weight || 0;
    
  const startWeight = user?.weight || 0; // Idealnya simpan startWeight terpisah, tapi ini fallback
  const targetWeight = user?.idealWeight || 0;
  const weightDiff = Math.abs(currentWeight - startWeight);
  const totalGoalDiff = Math.abs(targetWeight - startWeight);
  
  // Kalkulasi Persentase Progress
  // Jika target < start (Diet): (Start - Current) / (Start - Target)
  // Jika target > start (Bulking): (Current - Start) / (Target - Start)
  let progressPercent = 0;
  if (totalGoalDiff > 0) {
     if (targetWeight < startWeight) {
        progressPercent = Math.max(0, Math.min(100, ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100));
     } else {
        progressPercent = Math.max(0, Math.min(100, ((currentWeight - startWeight) / (targetWeight - startWeight)) * 100));
     }
  }

  // Rata-rata 7 Hari
  const avgCaloriesIn = Math.round(weeklyStats.reduce((acc, curr) => acc + curr.caloriesIn, 0) / 7);
  const avgCaloriesBurn = Math.round(weeklyStats.reduce((acc, curr) => acc + curr.caloriesBurned, 0) / 7);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 text-center">
      <div>
        <p className="text-xl font-semibold mb-2">Tidak dapat memuat data progress.</p>
        <p className="text-sm text-gray-200">Pastikan kamu sudah login dan profil kamu sudah terisi. Coba refresh halaman jika masalah masih terjadi.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="h-8 w-8 mr-3 text-emerald-600" />
              Track Your Progress
            </h1>
            <p className="text-gray-600 mt-2">Monitor your weight, calories, and fitness journey.</p>
          </div>
          <button
            onClick={() => setShowAddEntry(true)}
            className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 transform hover:scale-105"
          >
            <Plus className="h-5 w-5 mr-2" />
            Update Weight
          </button>
        </div>

        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card Berat */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 font-medium">Current Weight</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{currentWeight} <span className="text-base font-normal text-gray-500">kg</span></h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Scale size={24} />
              </div>
            </div>
          </div>

          {/* Card Target */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm text-gray-500 font-medium">Target Weight</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{targetWeight} <span className="text-base font-normal text-gray-500">kg</span></h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Target size={24} />
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-1000" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right font-semibold">{Math.round(progressPercent)}% Achieved</p>
          </div>

          {/* Card Avg Intake */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm text-gray-500 font-medium">Avg Daily Intake</p>
                   <h3 className="text-3xl font-bold text-gray-900 mt-2">{avgCaloriesIn}</h3>
                   <p className="text-xs text-gray-500 mt-1">kcal/day</p>
                </div>
                <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                   <Utensils size={24} />
                </div>
             </div>
             <p className="text-xs text-gray-400 mt-3">Last 7 days</p>
          </div>

          {/* Card Avg Burn */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm text-gray-500 font-medium">Avg Calories Burned</p>
                   <h3 className="text-3xl font-bold text-gray-900 mt-2">{avgCaloriesBurn}</h3>
                   <p className="text-xs text-gray-500 mt-1">kcal/day</p>
                </div>
                <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                   <Flame size={24} />
                </div>
             </div>
             <p className="text-xs text-gray-400 mt-3">Last 7 days</p>
          </div>
        </div>

        {/* --- GRAFIK SECTION --- */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          
          {/* GRAFIK 1: BERAT BADAN (Dynamic Scale) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
              <TrendingUp className="mr-3 text-emerald-600" size={24}/> Weight Progression
            </h3>
            
            <div className="relative h-64 w-full">
              {progressEntries.length > 0 ? (
                <div className="flex items-end justify-between h-full px-2 gap-2">
                  {progressEntries.slice(-7).map((entry, idx) => {
                    // LOGIC ZOOM: Cari min dan max dari data yang ditampilkan saja
                    const recentEntries = progressEntries.slice(-7);
                    const weights = recentEntries.map(e => e.weight);
                    const minWeight = Math.min(...weights) - 0.5; // Buffer bawah
                    const maxWeight = Math.max(...weights) + 0.5; // Buffer atas
                    const range = maxWeight - minWeight || 1; 

                    // Hitung tinggi batang dalam persen (relatif terhadap min/max view)
                    const heightPercent = ((entry.weight - minWeight) / range) * 100;
                    // Clamp nilai agar tidak overflow
                    const safeHeight = Math.max(5, Math.min(100, heightPercent));

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Tooltip Hover */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs py-2 px-3 rounded-lg shadow-lg whitespace-nowrap z-10">
                          {entry.weight} kg
                          <div className="text-[10px] text-gray-300">{entry.notes}</div>
                        </div>
                        
                        {/* Bar */}
                        <div 
                          className="w-full max-w-[40px] bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg shadow-sm hover:from-emerald-600 hover:to-emerald-500 transition-all cursor-pointer relative"
                          style={{ height: `${safeHeight}%` }}
                        >
                            {/* Label Berat di atas batang (jika cukup ruang) */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700">
                                {entry.weight}
                            </span>
                        </div>
                        
                        {/* Tanggal */}
                        <span className="text-[10px] text-gray-500 mt-2 font-medium">
                          {new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <Scale className="mb-2 opacity-50" size={32} />
                  <p className="text-sm font-medium">No weight data yet</p>
                  <button onClick={() => setShowAddEntry(true)} className="mt-3 text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors">
                    + Add First Entry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* GRAFIK 2: KALORI MASUK VS KELUAR */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <Activity className="mr-3 text-blue-600" size={24}/> Daily Calories
                </h3>
                <div className="text-xs font-semibold px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-full">
                    Goal: {user.dailyCalories} kcal
                </div>
            </div>
            
            <div className="h-64 relative">
                {(() => {
                    const maxVal = Math.max(
                        user.dailyCalories * 1.1, 
                        ...weeklyStats.map(s => Math.max(s.caloriesIn, s.caloriesBurned, 100))
                    );
                    const targetPercent = (user.dailyCalories / maxVal) * 100;

                    return (
                        <>
                            {/* Target Line */}
                            <div 
                                className="absolute w-full border-t-2 border-dashed border-gray-300 z-0 pointer-events-none flex items-end justify-end opacity-60"
                                style={{ bottom: `${targetPercent}%` }}
                            >
                                <span className="text-[10px] text-gray-400 bg-white/80 px-1 -mb-4 mr-2">
                                    Target
                                </span>
                            </div>

                            <div className="flex items-end justify-between gap-2 h-full relative z-10 px-2">
                                {weeklyStats.map((stat, idx) => {
                                    const hIn = (stat.caloriesIn / maxVal) * 100;
                                    const hOut = (stat.caloriesBurned / maxVal) * 100;
                                    const isToday = stat.date === getDateKey(new Date());

                                    return (
                                        <div key={idx} className={`flex-1 flex flex-col items-center gap-1 group relative h-full justify-end ${isToday ? 'bg-blue-50/30 rounded-xl' : ''}`}>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-2 px-3 rounded-lg z-20 pointer-events-none whitespace-nowrap shadow-xl">
                                                <div className="font-bold border-b border-gray-700 pb-1 mb-1">{new Date(stat.date).toLocaleDateString('id-ID', {weekday: 'long'})}</div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-green-400">Masuk:</span> <span className="font-mono">{stat.caloriesIn}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-orange-400">Keluar:</span> <span className="font-mono">{stat.caloriesBurned}</span></div>
                                                <div className="mt-1 pt-1 border-t border-gray-700 flex items-center justify-between gap-3">
                                                    <span className="text-gray-300">Net:</span>
                                                    <span className={`font-mono font-bold ${stat.netCalories > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                                        {stat.netCalories > 0 ? '+' : ''}{stat.netCalories}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="w-full flex gap-1 items-end justify-center h-full pb-6 px-1">
                                                {/* Bar In */}
                                                <div className="relative w-1/2 h-full flex items-end justify-center">
                                                    <div style={{ height: `${stat.caloriesIn > 0 ? Math.max(2, hIn) : 0}%` }} className={`w-full rounded-t-md transition-all duration-500 ${stat.caloriesIn > user.dailyCalories ? 'bg-red-400' : 'bg-green-500'} opacity-90 group-hover:opacity-100`}></div>
                                                </div>
                                                {/* Bar Out */}
                                                <div className="relative w-1/2 h-full flex items-end justify-center">
                                                    <div style={{ height: `${stat.caloriesBurned > 0 ? Math.max(2, hOut) : 0}%` }} className="w-full bg-orange-400 rounded-t-md opacity-90 group-hover:opacity-100 transition-all duration-500"></div>
                                                </div>
                                            </div>

                                            <span className={`absolute bottom-0 text-[10px] font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                                {new Date(stat.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    );
                })()}
            </div>
            
            <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-gray-500">
                <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded mr-1"></div> Makanan</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-orange-400 rounded mr-1"></div> Latihan (Out)</div>
                <div className="flex items-center"><div className="w-3 h-1 border-t border-dashed border-gray-400 mr-1"></div> Target</div>
            </div>
          </div>

          {/* GRAFIK 3: MAKRONUTRISI (STACKED BAR) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
              <PieChart className="mr-3 text-purple-600" size={24}/> Macronutrient Composition
            </h3>
            
            <div className="h-64 relative">
                <div className="flex items-end justify-between gap-2 h-full px-2">
                {weeklyStats.map((stat, idx) => {
                    // Total gram makro untuk skala grafik
                    const totalGrams = stat.protein + stat.carbs + stat.fat;
                    // Cari nilai tertinggi minggu ini untuk normalisasi tinggi bar
                    const maxGramsWeek = Math.max(100, ...weeklyStats.map(s => s.protein + s.carbs + s.fat));
                    
                    // Tinggi relatif bar terhadap minggu ini
                    const barHeightPercent = totalGrams > 0 ? (totalGrams / maxGramsWeek) * 100 : 0;

                    return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-2 px-3 rounded z-20 pointer-events-none whitespace-nowrap shadow-xl">
                            <div className="font-bold border-b border-gray-700 pb-1 mb-1">{new Date(stat.date).toLocaleDateString('id-ID', {weekday: 'long'})}</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full"></div> Protein: {stat.protein}g</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full"></div> Karbo: {stat.carbs}g</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-400 rounded-full"></div> Lemak: {stat.fat}g</div>
                        </div>
                        
                        {/* Stacked Bar */}
                        <div style={{ height: `${Math.max(2, barHeightPercent)}%` }} className="w-full max-w-[40px] flex flex-col-reverse rounded-t-lg overflow-hidden bg-gray-100 relative">
                            {totalGrams > 0 && (
                              <>
                                <div style={{ height: `${(stat.protein / totalGrams) * 100}%` }} className="w-full bg-orange-500 transition-all hover:opacity-90"></div>
                                <div style={{ height: `${(stat.carbs / totalGrams) * 100}%` }} className="w-full bg-yellow-400 transition-all hover:opacity-90"></div>
                                <div style={{ height: `${(stat.fat / totalGrams) * 100}%` }} className="w-full bg-blue-400 transition-all hover:opacity-90"></div>
                              </>
                            )}
                        </div>

                        <span className="text-[10px] font-medium text-gray-400">
                            {new Date(stat.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                        </span>
                    </div>
                    );
                })}
                </div>
            </div>
            
            <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-gray-500">
                <div className="flex items-center"><div className="w-3 h-3 bg-orange-500 rounded-full mr-1"></div> Protein</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-yellow-400 rounded-full mr-1"></div> Karbo</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-blue-400 rounded-full mr-1"></div> Lemak</div>
            </div>
          </div>
        </div>

        {/* --- RIWAYAT HARIAN (LIST VIEW) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Calendar className="mr-3 text-emerald-600" size={24}/>
              Daily Summary
            </h3>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">Last 7 Days</span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {[...weeklyStats].reverse().map((day) => {
              const isToday = day.date === getDateKey(new Date());
              // Tampilkan jika hari ini ATAU ada datanya
              const hasData = day.caloriesIn > 0 || day.caloriesBurned > 0;

              if (!hasData && !isToday) return null;

              return (
                <div key={day.date} className={`p-5 hover:bg-gray-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Tanggal */}
                    <div className="min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long' })}</span>
                        {isToday && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">HARI INI</span>}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(day.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</span>
                    </div>

                    {/* Stats Grid */}
                    <div className="flex-grow grid grid-cols-3 gap-2 sm:gap-4">
                       {/* Box Makanan */}
                       <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1"><Utensils size={10}/> Makan</div>
                          <div className="font-bold text-green-700">{day.caloriesIn}</div>
                          {/* Micro Macro Info */}
                          <div className="flex justify-center gap-1 mt-1 text-[8px] text-gray-400">
                            <span className="text-orange-600">P:{day.protein}</span>
                            <span className="text-yellow-600">K:{day.carbs}</span>
                            <span className="text-blue-600">L:{day.fat}</span>
                          </div>
                       </div>
                       
                       {/* Box Latihan */}
                       <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1"><Dumbbell size={10}/> Bakar</div>
                          <div className="font-bold text-orange-600">{day.caloriesBurned}</div>
                       </div>

                       {/* Box Net */}
                       <div className={`border rounded-lg p-2 text-center ${day.netCalories > 0 ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                          <div className="text-xs text-gray-500 mb-1">Sisa/Defisit</div>
                          <div className={`font-bold ${day.netCalories > 0 ? 'text-gray-800' : 'text-green-600'}`}>
                             {day.netCalories > 0 ? '+' : ''}{day.netCalories}
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL INPUT BERAT */}
        {showAddEntry && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Scale className="mr-2 text-emerald-600" />
                  Update Weight
                </h2>
                <button onClick={() => setShowAddEntry(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">✕</button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Weight Today (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={newEntry.weight}
                      onChange={(e) => setNewEntry({...newEntry, weight: e.target.value})}
                      className="w-full p-4 pl-4 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-3xl font-bold text-center transition-all"
                      placeholder="0.0"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">kg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none resize-none text-sm transition-all"
                    rows={2}
                    placeholder="e.g., After gym session..."
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddEntry(false)} className="flex-1 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                  <button onClick={addProgressEntryHandler} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg shadow-md transition-all transform hover:scale-105">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Progress;

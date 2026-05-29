import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, addDoc, updateDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { getDateKey, saveUserLog } from '../services/logger';
// Local workout dataset (author-provided)
import workoutData from '../data/data_setengah';

// --- TYPE DEFINITIONS ---

interface UserProfile {
  weight: number;
  height: number;
  age: number;
  gender: string;
  goal: string;
  activityLevel: string;
  dailyCalories: number;
  idealWeight?: number;
  dietaryRestrictions?: string[];
  allergies?: string[];
  fullname?: string;
  name?: string;
  bmi?: number;
  xp?: number;
  totalXp?: number;
  highestRank?: string;
  rank?: string;
  lastInactivityPenalty?: any; // Timestamp from Firestore
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number;
  monounsaturatedFat?: number;
  polyunsaturatedFat?: number;
  sugars?: number;
  dietaryFiber?: number;
  cholesterol?: number;
  sodium?: number;
  servingSize: string;
  mealType: MealType;
  source: 'ai' | 'manual';
  consumed: boolean;
  reasoning?: string; // For AI meals
  portions?: string; // For AI meals
}

interface MealLog {
  date: string;
  userId: string;
  foods: FoodItem[];
  caloriesIn: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: string;
  caloriesPerSet: number;
  completed: boolean;
  caloriesBurned?: number;
}

interface WorkoutLog {
    date: string;
    userId: string;
    exercises: WorkoutExercise[];
    totalCalories: number;
    totalDuration: number;
    workoutType: string;
    workoutLocation?: 'home' | 'gym';
}

export interface ProgressEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
}

export type MealType = 'Sarapan' | 'MakanSiang' | 'MakanMalam' | 'snacks';

interface DailyLogContextType {
  // State
  userProfile: UserProfile | null;
  mealLog: MealLog | null;
  workoutLog: WorkoutLog | null;
  isLoading: boolean;
  isGeneratingAI: boolean;
  aiError: string | null;
  
  // Derived Data
  consumedCalories: number;
  burnedCalories: number;
  remainingCalories: number;
  macros: { protein: number; carbs: number; fat: number };

  // Meal Actions
  addFoodItem: (food: Omit<FoodItem, 'id' | 'consumed' | 'mealType' | 'source'>, mealType: MealType) => Promise<void>;
  toggleFoodConsumed: (foodId: string) => Promise<void>;
  removeFoodItem: (foodId: string) => Promise<void>;
  generateAIMealPlan: () => Promise<void>;

  // Workout Actions
  addExercise: (exercise: Omit<WorkoutExercise, 'id' | 'completed'>) => Promise<void>;
  toggleExerciseCompleted: (exerciseId: string) => Promise<void>;
  removeExercise: (exerciseId: string) => Promise<void>;
  generateAIWorkoutPlan: (location: 'home' | 'gym', split?: string) => Promise<void>;

  // Progress Actions
  addProgressEntry: (weight: number, notes?: string) => Promise<void>;
  updateProgressEntry: (entryId: string, weight: number, notes?: string) => Promise<void>;
}

// --- HELPER ---
// Updated Rank Requirements - Much More Challenging (Especially Bronze→Silver)
export const getRankFromXP = (xp: number): string => {
  if (xp >= 15000) return 'Shadow Monarch';
  if (xp >= 7000) return 'platinum';
  if (xp >= 3000) return 'gold';
  if (xp >= 1000) return 'silver';
  return 'bronze';
};

// Reduced XP Rewards - Slower Progression
const XP_REWARDS = {
  MEAL: 5,
  WORKOUT: 25,
  PROGRESS: 10
};

// Inactivity Penalty System Constants
const INACTIVITY_PENALTY = 100; // XP to deduct
const INACTIVITY_THRESHOLD_DAYS = 2; // Days without workout

const normalizeAIMealPlan = (plan: any): FoodItem[] => {
    const MEAL_TYPES: MealType[] = ['Sarapan', 'MakanSiang', 'MakanMalam', 'snacks'];
    const foods: FoodItem[] = [];
  
    MEAL_TYPES.forEach((type) => {
      const value = plan[type];
      let arr: any[] = [];
      if (!value) return;
      else if (Array.isArray(value)) arr = value;
      else arr = [value];
  
      arr.forEach((m: any, idx: number) => {
        foods.push({
          id: m.id ?? `ai-${type}-${idx}-${Date.now()}`,
          name: m.menu ?? m.name ?? '',
          calories: Number(m.calories ?? 0),
          protein: Number(m.protein ?? 0),
          carbs: Number(m.carbs ?? 0),
          fat: Number(m.fat ?? 0),
          servingSize: m.portions ?? m.servingSize ?? '1 porsi',
          mealType: type,
          source: 'ai',
          consumed: false, // AI meals start as not consumed
          reasoning: m.reasoning ?? '',
          portions: m.portions ?? '',
        });
      });
    });
    return foods;
  };

// --- INACTIVITY PENALTY SYSTEM ---
/**
 * Check if user has been inactive (no workout for 2+ days)
 * and apply penalty if needed
 */
const checkAndApplyInactivityPenalty = async (userProfile: UserProfile, workoutLog: WorkoutLog | null) => {
  if (!auth.currentUser || !userProfile) return;

  try {
    // Get all workout logs for the user
    const logsRef = collection(db, 'workout_logs');
    const q = query(logsRef, where('userId', '==', auth.currentUser.uid), orderBy('date', 'desc'), limit(10));
    const logsSnap = await getDocs(q);

    if (logsSnap.empty) {
      // User has never worked out, apply penalty
      const penaltyXP = Math.max(0, (userProfile.xp || 0) - INACTIVITY_PENALTY);
      const penaltyTotalXP = Math.max(0, (userProfile.totalXp || 0) - INACTIVITY_PENALTY);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        xp: penaltyXP,
        totalXp: penaltyTotalXP,
        rank: getRankFromXP(penaltyXP),
        lastInactivityPenalty: serverTimestamp()
      });
      return;
    }

    // Check the most recent workout date
    const mostRecentLog = logsSnap.docs[0]?.data();
    if (!mostRecentLog) return;

    const lastWorkoutDate = new Date(mostRecentLog.date);
    const today = new Date();
    const daysDifference = Math.floor((today.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));

    // If 2+ days have passed since last workout, apply penalty
    if (daysDifference >= INACTIVITY_THRESHOLD_DAYS) {
      // Check if penalty was already applied recently (to avoid duplicate penalties)
      const lastPenaltyTime = userProfile.lastInactivityPenalty ? new Date(userProfile.lastInactivityPenalty).getTime() : 0;
      const penaltyExpiry = 24 * 60 * 60 * 1000; // 24 hours between penalties
      
      if (Date.now() - lastPenaltyTime >= penaltyExpiry) {
        const penaltyXP = Math.max(0, (userProfile.xp || 0) - INACTIVITY_PENALTY);
        const penaltyTotalXP = Math.max(0, (userProfile.totalXp || 0) - INACTIVITY_PENALTY);

        console.log(`Inactivity Penalty Applied: -${INACTIVITY_PENALTY} XP for ${daysDifference} days of no workout`);
        
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          xp: penaltyXP,
          totalXp: penaltyTotalXP,
          rank: getRankFromXP(penaltyXP),
          lastInactivityPenalty: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error("Error checking inactivity penalty:", error);
  }
};

// --- CONTEXT CREATION ---
const DailyLogContext = createContext<DailyLogContextType | undefined>(undefined);

// --- PROVIDER COMPONENT ---
export const DailyLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- REALTIME DATA FETCHING ---
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubMeals: (() => void) | null = null;
    let unsubWorkouts: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanupSubscriptions = () => {
      if (unsubProfile) unsubProfile();
      if (unsubMeals) unsubMeals();
      if (unsubWorkouts) unsubWorkouts();
      if (timer) clearTimeout(timer);
    };

    const loadLocalProfile = (): UserProfile | null => {
      const stored = localStorage.getItem('user');
      if (!stored) return null;
      try {
        return JSON.parse(stored) as UserProfile;
      } catch (e) {
        console.warn('Failed to parse local user profile:', e);
        return null;
      }
    };

    const startAuthListener = (callback: (user: any) => void) => {
      if (typeof onAuthStateChanged === 'function') {
        return onAuthStateChanged(auth, callback);
      }
      if (typeof (auth as any).onAuthStateChanged === 'function') {
        return (auth as any).onAuthStateChanged(callback);
      }
      throw new Error('Firebase auth listener is not available.');
    };

    const authUnsub = startAuthListener((user) => {
      cleanupSubscriptions();

      if (!user) {
        setIsLoading(false);
        setUserProfile(null);
        setMealLog(null);
        setWorkoutLog(null);
        return;
      }

      setIsLoading(true);
      const uid = user.uid;
      const todayKey = getDateKey(new Date());

      unsubProfile = onSnapshot(doc(db, 'users', uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          const local = loadLocalProfile();
          if (local) {
            setUserProfile(local);
          } else {
            setUserProfile(null);
          }
        }
      });

      unsubMeals = onSnapshot(doc(db, 'meal_logs', `${uid}_${todayKey}`), (doc) => {
        if (doc.exists()) {
          setMealLog(doc.data() as MealLog);
        } else {
          setMealLog({ userId: uid, date: todayKey, foods: [], caloriesIn: 0, protein: 0, carbs: 0, fat: 0 });
        }
      });

      unsubWorkouts = onSnapshot(doc(db, 'workout_logs', `${uid}_${todayKey}`), (doc) => {
        setWorkoutLog(doc.exists() ? (doc.data() as WorkoutLog) : null);
      });

      timer = setTimeout(() => setIsLoading(false), 1500);
    });

    return () => {
      authUnsub();
      cleanupSubscriptions();
    };
  }, []);

  // --- DERIVED DATA ---
  const { consumedCalories, macros } = useMemo(() => {
    const initial = { consumedCalories: 0, macros: { protein: 0, carbs: 0, fat: 0 } };
    if (!mealLog) return initial;
    return mealLog.foods.reduce((acc, food) => {
      if (food.consumed) {
        acc.consumedCalories += food.calories || 0;
        acc.macros.protein += food.protein || 0;
        acc.macros.carbs += food.carbs || 0;
        acc.macros.fat += food.fat || 0;
      }
      return acc;
    }, initial);
  }, [mealLog]);

  // --- INACTIVITY CHECK EFFECT ---
  // Check for inactivity when user profile updates
  useEffect(() => {
    if (userProfile && auth.currentUser) {
      checkAndApplyInactivityPenalty(userProfile, workoutLog);
    }
  }, [userProfile?.xp, auth.currentUser?.uid]);

  const burnedCalories = useMemo(() => workoutLog?.totalCalories || 0, [workoutLog]);

  const remainingCalories = useMemo(() => 
    (userProfile?.dailyCalories || 0) - consumedCalories + burnedCalories,
    [userProfile, consumedCalories, burnedCalories]
  );

  // --- XP SYSTEM ---
  const addXP = useCallback(async (amount: number) => {
    if (!auth.currentUser || !userProfile) return;
    
    const currentSeasonXP = userProfile.xp || 0;
    const currentTotalXP = userProfile.totalXp || 0;
    
    const newSeasonXP = Math.max(0, currentSeasonXP + amount);
    const newTotalXP = Math.max(0, currentTotalXP + amount);
    
    const newRank = getRankFromXP(newSeasonXP);
    
    // Cek apakah ini rank tertinggi baru
    const ranks = ['bronze', 'silver', 'gold', 'platinum', 'Shadow Monarch'];
    const currentHighestIdx = ranks.indexOf(userProfile.highestRank || 'bronze');
    const newRankIdx = ranks.indexOf(newRank);
    
    const finalHighestRank = newRankIdx > currentHighestIdx ? newRank : (userProfile.highestRank || 'bronze');
    
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        xp: newSeasonXP,
        totalXp: newTotalXP,
        rank: newRank,
        highestRank: finalHighestRank
      });
    } catch (err) {
      console.error("Error updating XP:", err);
    }
  }, [userProfile]);

  // --- ACTIONS ---
  const updateMealLog = useCallback(async (updatedFoods: FoodItem[]) => {
    if (!auth.currentUser || !userProfile) return;
    const totals = updatedFoods.filter(f => f.consumed).reduce((acc, f) => {
        acc.caloriesIn += f.calories || 0;
        acc.protein += f.protein || 0;
        acc.carbs += f.carbs || 0;
        acc.fat += f.fat || 0;
        return acc;
    }, { caloriesIn: 0, protein: 0, carbs: 0, fat: 0 });
    
    await saveUserLog('meal', { foods: updatedFoods, ...totals }, getDateKey(new Date()));
  }, [userProfile]);

  const addFoodItem = useCallback(async (food: Omit<FoodItem, 'id' | 'consumed' | 'mealType' | 'source'>, mealType: MealType) => {
    const newFood: FoodItem = {
      ...food,
      id: `f-${Date.now()}`,
      consumed: true,
      mealType: mealType,
      source: 'manual',
    };
    await updateMealLog([...(mealLog?.foods || []), newFood]);
  }, [mealLog, updateMealLog]);

  const toggleFoodConsumed = useCallback(async (foodId: string) => {
    if (!mealLog) return;
    const food = mealLog.foods.find(f => f.id === foodId);
    if (!food) return;

    const updatedFoods = mealLog.foods.map(f => f.id === foodId ? { ...f, consumed: !f.consumed } : f);
    await updateMealLog(updatedFoods);
    await addXP(!food.consumed ? XP_REWARDS.MEAL : -XP_REWARDS.MEAL);
  }, [mealLog, updateMealLog, addXP]);
  
  const removeFoodItem = useCallback(async (foodId: string) => {
    if (!mealLog) return;
    await updateMealLog(mealLog.foods.filter(f => f.id !== foodId));
  }, [mealLog, updateMealLog]);

  const generateAIMealPlan = useCallback(async () => {
    if (!userProfile) {
      setAiError("User profile is not loaded.");
      return;
    }
    setIsGeneratingAI(true);
    setAiError(null);
    try {
        const { callAi, parseJsonLike } = await import('../utils/aiClient');
        const variationSeed = Math.floor(Math.random() * 10000);
        const prompt = `
        TUGAS: Buatkan 1 set rencana makan harian yang unik dan kreatif (Variation Seed: ${variationSeed}). 
        ATURAN:
        1. EKSPLORASI: Hindari menu standar (Nasi Goreng/Gado-gado). Gunakan bahan beragam (seafood, kacang-kacangan, umbi-umbian).
        2. KELENGKAPAN NUTRISI: Target Harian: ${userProfile.dailyCalories} kcal.
        2. PORSI DETAIL: Field "portions" WAJIB spesifik (contoh: "100g Nasi Merah, 1 butir Telur Rebus").
        STRUKTUR JSON:
        {
          "Sarapan": {"id":"b-${variationSeed}","menu":"Nama Menu","calories":0,"protein":0,"carbs":0,"fat":0,"reasoning":"...","portions":"..."},
          "MakanSiang": {"id":"l-${variationSeed}","menu":"Nama Menu","calories":0,"protein":0,"carbs":0,"fat":0,"reasoning":"...","portions":"..."},
          "MakanMalam": {"id":"d-${variationSeed}","menu":"Nama Menu","calories":0,"protein":0,"carbs":0,"fat":0,"reasoning":"...","portions":"..."},
          "snacks": {"id":"s-${variationSeed}","menu":"Nama Menu","calories":0,"protein":0,"carbs":0,"fat":0,"reasoning":"...","portions":"..."}
        }
        PROFIL USER:
        - Usia: ${userProfile.age}, Gender: ${userProfile.gender}
        - BB: ${userProfile.weight}kg, TB: ${userProfile.height}cm
        - Target: ${userProfile.goal}`;

        const data = await callAi([{ role: 'user', content: prompt }], 'llama-3.1-8b-instant', 120000);
        if (data.offline || !data.reply) throw new Error(data.reply || 'AI is offline.');

        const parsedPlan = parseJsonLike(data.reply);
        if (!parsedPlan || typeof parsedPlan !== 'object') {
          throw new Error('Failed to parse AI response. Please try again.');
        }

        const aiFoods = normalizeAIMealPlan(parsedPlan);
        if (aiFoods.length === 0) {
          throw new Error('No meals generated. Please try again.');
        }
        
        const manualFoods = mealLog?.foods.filter(f => f.source === 'manual') || [];
        await updateMealLog([...manualFoods, ...aiFoods]);

    } catch (err: any) {
        console.error("AI Error:", err);
        setAiError(err.message || "Gagal menyusun menu AI. Silakan coba lagi.");
    } finally {
        setIsGeneratingAI(false);
    }
  }, [userProfile, mealLog, updateMealLog]);

  // --- WORKOUT ACTIONS ---
  const updateWorkoutLog = useCallback(async (updatedExercises: WorkoutExercise[], locationOverride?: 'home' | 'gym', typeOverride?: string) => {
    if (!auth.currentUser || !userProfile) return;
    const totalCalories = updatedExercises.reduce((sum, ex) => {
      return sum + (ex.completed ? (ex.caloriesBurned || ex.caloriesPerSet || 0) : 0);
    }, 0);
    const totalDuration = updatedExercises.length * 30; // Assume 30 mins per exercise
    const workoutLocation = locationOverride ?? workoutLog?.workoutLocation ?? 'home';

    await saveUserLog('workout', {
      exercises: updatedExercises,
      totalCalories,
      totalDuration,
      workoutType: typeOverride || workoutLog?.workoutType || 'General',
      workoutLocation,
    }, getDateKey(new Date()));
  }, [userProfile, workoutLog]);

  const addExercise = useCallback(async (exercise: Omit<WorkoutExercise, 'id' | 'completed'>) => {
    const newExercise: WorkoutExercise = {
      ...exercise,
      id: `ex-${Date.now()}`,
      completed: false,
    };
    await updateWorkoutLog([...(workoutLog?.exercises || []), newExercise]);
  }, [workoutLog, updateWorkoutLog]);

  const toggleExerciseCompleted = useCallback(async (exerciseId: string) => {
    if (!workoutLog || !Array.isArray(workoutLog.exercises)) return;
    const ex = workoutLog.exercises.find(e => e.id === exerciseId);
    if (!ex) return;

    const updatedExercises = workoutLog.exercises.map(ex => 
      ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
    );
    await updateWorkoutLog(updatedExercises);
    await addXP(!ex.completed ? XP_REWARDS.WORKOUT : -XP_REWARDS.WORKOUT);
  }, [workoutLog, updateWorkoutLog, addXP]);

  const removeExercise = useCallback(async (exerciseId: string) => {
    if (!workoutLog || !Array.isArray(workoutLog.exercises)) return;
    await updateWorkoutLog(workoutLog.exercises.filter(ex => ex.id !== exerciseId));
  }, [workoutLog, updateWorkoutLog]);

  const generateAIWorkoutPlan = useCallback(async (location: 'home' | 'gym', split: string = 'Full Body') => {
    if (!userProfile) {
      setAiError("User profile is not loaded.");
      return;
    }
    setIsGeneratingAI(true);
    setAiError(null);

    try {
      // Local generator using provided dataset `data_setengah.ts`
      const pool = Array.isArray(workoutData) ? workoutData.slice() : [];

      // Filter by equipment when possible (heuristic)
      const filtered = pool.filter((item: any) => {
        if (!item) return false;
        const eq = (item.equipment || '').toString().toLowerCase();
        if (location === 'gym') return eq.includes('gym') || eq.includes('garage') || eq.includes('barbell') || eq.includes('dumbbell');
        if (location === 'home') return eq === '' || eq.includes('bodyweight') || eq.includes('home') || eq.includes('no equipment');
        return true;
      });

      // Shuffle helper
      const shuffle = <T,>(arr: T[]) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const pickCount = 6;
      const candidates = shuffle(filtered.length ? filtered : pool);
      const picked = candidates.slice(0, Math.min(pickCount, candidates.length));

      const aiExercises: WorkoutExercise[] = picked.map((it: any, idx: number) => {
        const name = (it.exercise_name || it.exercise || it.title || 'Exercise').toString();
        const setsNum = Number(it.sets) && Number.isFinite(Number(it.sets)) ? Math.max(1, Math.round(Number(it.sets))) : 3;
        const repsNum = Number(it.reps) && Number.isFinite(Number(it.reps)) ? Math.abs(Math.round(Number(it.reps))) : 10;
        const sets = `${setsNum}x${repsNum}`;
        const intensity = Number(it.intensity) || 5;
        const caloriesPerSet = Math.max(5, Math.round(intensity * 2));

        return {
          id: `local-ex-${idx}-${Date.now()}`,
          name,
          sets,
          caloriesPerSet,
          completed: false,
        } as WorkoutExercise;
      });

      const manualExercises = workoutLog?.exercises.filter(ex => !ex.id?.startsWith('ai-ex') && !ex.id?.startsWith('local-ex')) || [];
      await updateWorkoutLog([...manualExercises, ...aiExercises], location, split);

    } catch (err: any) {
      console.error("Local Workout Error:", err);
      setAiError(err?.message || "Gagal menyusun rencana latihan lokal. Silakan coba lagi.");
    } finally {
      setIsGeneratingAI(false);
    }
  }, [userProfile, workoutLog, updateWorkoutLog]);

  // --- PROGRESS ACTIONS ---
  const addProgressEntry = useCallback(async (weight: number, notes?: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const todayKey = getDateKey(new Date());
    
    try {
      await addDoc(collection(db, 'weight_logs'), {
        userId: uid,
        date: todayKey,
        weight,
        notes,
        createdAt: serverTimestamp()
      });

      await addXP(XP_REWARDS.PROGRESS);
    } catch (err) {
      console.error("Error adding progress entry:", err);
      setAiError("Failed to save progress entry.");
    }
  }, [addXP]);

  const updateProgressEntry = useCallback(async (entryId: string, weight: number, notes?: string) => {
    try {
      await updateDoc(doc(db, 'weight_logs', entryId), {
        weight,
        notes,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating progress entry:", err);
      setAiError("Failed to update progress entry.");
    }
  }, []);

  const value = {
    userProfile, mealLog, workoutLog, isLoading, isGeneratingAI, aiError,
    consumedCalories, burnedCalories, remainingCalories, macros,
    addFoodItem, toggleFoodConsumed, removeFoodItem, generateAIMealPlan,
    addExercise, toggleExerciseCompleted, removeExercise, generateAIWorkoutPlan,
    addProgressEntry, updateProgressEntry,
  };

  return <DailyLogContext.Provider value={value}>{children}</DailyLogContext.Provider>;
};

export const useDailyLog = (): DailyLogContextType => {
  const context = useContext(DailyLogContext);
  if (context === undefined) throw new Error('useDailyLog must be used within a DailyLogProvider');
  return context;
};

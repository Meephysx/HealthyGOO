import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { getDateKey, saveUserLog } from '../services/logger';

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
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  generateAIWorkoutPlan: (location: 'home' | 'gym') => Promise<void>;

  // Progress Actions
  addProgressEntry: (weight: number, notes?: string) => Promise<void>;
  updateProgressEntry: (entryId: string, weight: number, notes?: string) => Promise<void>;
}

// --- HELPER ---
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

  const burnedCalories = useMemo(() => workoutLog?.totalCalories || 0, [workoutLog]);

  const remainingCalories = useMemo(() => 
    (userProfile?.dailyCalories || 0) - consumedCalories + burnedCalories,
    [userProfile, consumedCalories, burnedCalories]
  );

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
    const updatedFoods = mealLog.foods.map(f => f.id === foodId ? { ...f, consumed: !f.consumed } : f);
    await updateMealLog(updatedFoods);
  }, [mealLog, updateMealLog]);
  
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
        TUGAS: Buatkan 1 set rencana makan harian Indonesia. OUTPUT WAJIB JSON VALID.
        ATURAN:
        1. KELENGKapan NUTRISI: Target Harian: ${userProfile.dailyCalories} kcal.
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
        if (!parsedPlan) throw new Error('Failed to parse AI response.');

        const aiFoods = normalizeAIMealPlan(parsedPlan);
        const manualFoods = mealLog?.foods.filter(f => f.source === 'manual') || [];
        await updateMealLog([...manualFoods, ...aiFoods]);

    } catch (err: any) {
        console.error("AI Error:", err);
        setAiError("Gagal menyusun menu AI. Silakan coba lagi.");
    } finally {
        setIsGeneratingAI(false);
    }
  }, [userProfile, mealLog, updateMealLog]);

  // --- WORKOUT ACTIONS ---
  const updateWorkoutLog = useCallback(async (updatedExercises: WorkoutExercise[], locationOverride?: 'home' | 'gym') => {
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
      workoutType: workoutLog?.workoutType || 'General',
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
    const updatedExercises = workoutLog.exercises.map(ex => 
      ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
    );
    await updateWorkoutLog(updatedExercises);
  }, [workoutLog, updateWorkoutLog]);

  const removeExercise = useCallback(async (exerciseId: string) => {
    if (!workoutLog || !Array.isArray(workoutLog.exercises)) return;
    await updateWorkoutLog(workoutLog.exercises.filter(ex => ex.id !== exerciseId));
  }, [workoutLog, updateWorkoutLog]);

  const generateAIWorkoutPlan = useCallback(async (location: 'home' | 'gym') => {
    if (!userProfile) {
      setAiError("User profile is not loaded.");
      return;
    }
    setIsGeneratingAI(true);
    setAiError(null);
    try {
        const { callAi, parseJsonLike } = await import('../utils/aiClient');
        const prompt = `
        TUGAS: Buatkan 1 rencana latihan harian untuk ${location === 'home' ? 'rumah' : 'gym'} yang dirancang untuk pengguna. OUTPUT WAJIB JSON VALID.
        PROFIL USER:
        - Usia: ${userProfile.age}, Gender: ${userProfile.gender}
        - BB: ${userProfile.weight}kg, TB: ${userProfile.height}cm
        - Target: ${userProfile.goal}
        - Aktivitas: ${userProfile.activityLevel}
        - Target Kalori: ${userProfile.dailyCalories} kcal
        
        STRUKTUR JSON (ARRAY OF EXERCISES):
        [
          {"name":"Nama Latihan","sets":"3x10","caloriesPerSet":15,"reasoning":"..."}
        ]
        
        Buatkan 4-6 latihan yang dapat dilakukan di ${location === 'home' ? 'rumah menggunakan peralatan minimal atau bodyweight saja' : 'gym dengan akses alat kebugaran'}. Setiap exercise harus memiliki nama, sets, caloriesPerSet, dan reasoning.`;

        const data = await callAi([{ role: 'user', content: prompt }], 'llama-3.1-8b-instant', 120000);
        if (data.offline || !data.reply) throw new Error(data.reply || 'AI is offline.');

        const parsedExercises = parseJsonLike(data.reply);
        if (!Array.isArray(parsedExercises)) throw new Error('Invalid workout plan format.');

        const aiExercises: WorkoutExercise[] = parsedExercises.map((ex: any, idx: number) => ({
          id: `ai-ex-${idx}-${Date.now()}`,
          name: ex.name || 'Exercise',
          sets: ex.sets || '3x10',
          caloriesPerSet: ex.caloriesPerSet || 10,
          completed: false,
        }));

        const manualExercises = workoutLog?.exercises.filter(ex => !ex.id.startsWith('ai-ex')) || [];
        await updateWorkoutLog([...manualExercises, ...aiExercises], location);

    } catch (err: any) {
        console.error("AI Workout Error:", err);
        setAiError("Gagal menyusun rencana latihan. Silakan coba lagi.");
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
    } catch (err) {
      console.error("Error adding progress entry:", err);
      setAiError("Failed to save progress entry.");
    }
  }, []);

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

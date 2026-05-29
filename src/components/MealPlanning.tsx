import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Check, Sparkles, Loader, RefreshCw, X, Trash2 } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import AISearch, { type FoodDetail } from './FoodSearch';

import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { getUserProfile } from '../services/firestore';
import { saveUserLog, fetchUserLogByDate, getDateKey } from '../services/logger';
import { isEqual } from 'lodash';
import { calculateTDEE, getFoodRecommendationsKNN, FoodItem, MealTimeCategory } from '../services/knnService';


// --- Types Interfaces ---
interface User {
  weight: number;
  height: number;
  age: number;
  gender: string;
  goal: string;
  activityLevel: string;
  dailyCalories: number;
  dietaryRestrictions?: string[];
  allergies?: string[];
}

interface Food {
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
}

interface AIMeal {
  id?: string;
  menu: string;
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
  time: string;
  reasoning: string;
  portions: string;
}

interface AIMealPlan {
  Sarapan: AIMeal[];
  MakanSiang: AIMeal[];
  MakanMalam: AIMeal[];
  snacks?: AIMeal[];
  totalCalories: number;
  nutritionTips?: string;
  hydrationGoal?: string;
}

type MealType = 'Sarapan' | 'MakanSiang' | 'MakanMalam' | 'snacks';
const MEAL_TYPES: MealType[] = ['Sarapan', 'MakanSiang', 'MakanMalam', 'snacks'];

// --- HELPER FUNCTIONS (OUTSIDE COMPONENT) ---
const getFoodUniqueId = (foodId: string, mealType: string, date: Date): string => {
  const isCustom = foodId.startsWith('f-');
  const prefix = isCustom ? 'custom' : 'ai';
  return `${prefix}-${foodId}-${mealType}-${getDateKey(date)}`;
};

// PROBLEM 5 FIX: This function is now more robust against malformed AI responses.
const normalizeAIMealPlan = (plan: any): AIMealPlan | null => {
    if (!plan || typeof plan !== 'object') {
      console.error("Invalid AI plan format: not an object.", plan);
      return null;
    }

    const out: any = { ...plan };
    let hasContent = false;
    MEAL_TYPES.forEach((type) => {
      const value = out[type];
      let arr: any[] = [];
      if (Array.isArray(value)) arr = value;
      else if (value && typeof value === 'object') arr = [value];

      out[type] = arr.map((m: any, idx: number) => {
        if (m && (m.menu || m.name)) hasContent = true;
        return {
          id: m.id ?? `ai-${type}-${idx}-${Date.now()}`,
          menu: m.menu ?? m.name ?? 'Unnamed Item',
          calories: Number(m.calories ?? m.kalori ?? m.energy ?? 0),
          protein: Number(m.protein ?? m.proteins ?? 0),
          carbs: Number(m.carbs ?? m.karbohidrat ?? m.carbohydrate ?? 0),
          fat: Number(m.fat ?? m.lemak ?? 0),
          saturatedFat: Number(m.saturatedFat ?? m['Saturated Fats'] ?? 0),
          monounsaturatedFat: Number(m.monounsaturatedFat ?? m['Monounsaturated Fats'] ?? 0),
          polyunsaturatedFat: Number(m.polyunsaturatedFat ?? m['Polyunsaturated Fats'] ?? 0),
          sugars: Number(m.sugars ?? m.Sugars ?? 0),
          dietaryFiber: Number(m.dietaryFiber ?? m['Dietary Fiber'] ?? 0),
          cholesterol: Number(m.cholesterol ?? m.Cholesterol ?? 0),
          sodium: Number(m.sodium ?? m.Sodium ?? 0),
          time: m.time ?? '',
          reasoning: m.reasoning ?? '',
          portions: m.portions ?? ''
        };
      });
    });

    if (!hasContent) {
      console.error("Invalid AI plan: no valid meal items found.", plan);
      return null;
    }
    return out as AIMealPlan;
  };

const MealPlanning: React.FC = () => {
  // --- STATE ---
  // PROBLEM 2 FIX: authUser holds the reliable, listener-provided user state.
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null); // This is the Firestore profile data
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMeal, setSelectedMeal] = useState<MealType>('Sarapan');
  const [aiMealPlan, setAiMealPlan] = useState<AIMealPlan | null>(null);
  const [consumedFoods, setConsumedFoods] = useState<string[]>([]);
  
  const [customMealPlan, setCustomMealPlan] = useState<{ [key in MealType]: Food[] }>({
    Sarapan: [], MakanSiang: [], MakanMalam: [], snacks: []
  });
  
  const [showFoodSelector, setShowFoodSelector] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const { nutrition, updateNutrition } = useNutrition();

  // --- DATA SYNC & PERSISTENCE LOGIC (REFACTORED) ---
  // PROBLEM 4 FIX: The function now depends on `authUser` ensuring it has the UID before running.
  const saveMealDataToFirestore = useCallback(async (
    updatedCustomMeals: { [key in MealType]: Food[] },
    updatedAiPlan: AIMealPlan | null,
    updatedConsumed: string[]
  ) => {
    if (!authUser || !user) return; // Guard against calls when not authenticated.

    const dateKey = getDateKey(currentDate);
    const allFoods: any[] = [];
    
    Object.entries(updatedCustomMeals).forEach(([type, items]) => {
      items.forEach(item => allFoods.push({ ...item, mealType: type, source: 'manual', consumed: updatedConsumed.includes(getFoodUniqueId(item.id, type, currentDate)) }));
    });

    if (updatedAiPlan) {
      MEAL_TYPES.forEach(type => {
        updatedAiPlan[type]?.forEach(item => {
          if (!item || !item.id) return;
          allFoods.push({ ...item, name: item.menu, mealType: type, source: 'ai', consumed: updatedConsumed.includes(getFoodUniqueId(item.id, type, currentDate)) });
        });
      });
    }

    let total = { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0 };
    allFoods.filter(f => f.consumed).forEach(f => {
        total.calories += f.calories || 0;
        total.protein += f.protein || 0;
        total.carbs += f.carbs || 0;
        total.fat += f.fat || 0;
        total.sugars += f.sugars || 0;
    });

    const payload = {
        userId: authUser.uid,
        foods: allFoods,
        caloriesIn: total.calories,
        protein: total.protein,
        carbs: total.carbs,
        fat: total.fat,
        sugars: total.sugars,
        totalCalories: total.calories,
        date: dateKey,
        nutritionTips: updatedAiPlan?.nutritionTips || '',
        hydrationGoal: updatedAiPlan?.hydrationGoal || '',
    };

    try {
      await saveUserLog('meal', payload, dateKey);
      // This call to updateNutrition is safe because the useEffect that consumes it has guards.
      updateNutrition({ ...total, date: dateKey }); 
    } catch (e) {
      console.error("Failed to save meal log:", e);
    }
  }, [authUser, currentDate, user, updateNutrition]);

  // --- MEMOIZED VALUES ---
  const consumedNutrition = useMemo(() => {
    let total = { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0 };
    if (!user) return total;

    MEAL_TYPES.forEach(type => {
        aiMealPlan?.[type]?.forEach(meal => {
            if (meal?.id && consumedFoods.includes(getFoodUniqueId(meal.id, type, currentDate))) {
                total.calories += meal.calories || 0;
                total.protein += meal.protein || 0;
                total.carbs += meal.carbs || 0;
                total.fat += meal.fat || 0;
                total.sugars += meal.sugars || 0;
            }
        });
        customMealPlan[type]?.forEach(food => {
            if (consumedFoods.includes(getFoodUniqueId(food.id, type, currentDate))) {
                total.calories += food.calories || 0;
                total.protein += food.protein || 0;
                total.carbs += food.carbs || 0;
                total.fat += food.fat || 0;
                total.sugars += food.sugars || 0;
            }
        });
    });
    return total;
  }, [user, aiMealPlan, customMealPlan, consumedFoods, currentDate]);

  const calorieProgress = useMemo(() => 
    user && user.dailyCalories > 0 
      ? Math.min(100, (consumedNutrition.calories / user.dailyCalories) * 100) 
      : 0,
    [consumedNutrition.calories, user]
  );

  // --- HANDLERS (with immediate persistence) ---
  const isFoodConsumed = useCallback((foodId: string, mealType: string): boolean => {
    return consumedFoods.includes(getFoodUniqueId(foodId, mealType, currentDate));
  }, [consumedFoods, currentDate]);

  const toggleFoodConsumed = useCallback(async (foodId: string, mealType: string): Promise<void> => {
    const uniqueId = getFoodUniqueId(foodId, mealType, currentDate);
    const newConsumed = consumedFoods.includes(uniqueId)
      ? consumedFoods.filter(id => id !== uniqueId)
      : [...consumedFoods, uniqueId];
    
    setConsumedFoods(newConsumed);
    await saveMealDataToFirestore(customMealPlan, aiMealPlan, newConsumed);
  }, [currentDate, consumedFoods, customMealPlan, aiMealPlan, saveMealDataToFirestore]);

  const addFoodToMeal = useCallback(async (food: FoodDetail) => {
    const newCustomMealPlan = { 
      ...customMealPlan, 
      [selectedMeal]: [...customMealPlan[selectedMeal], { ...food, id: `f-${Date.now()}` }] 
    };
    setCustomMealPlan(newCustomMealPlan);
    await saveMealDataToFirestore(newCustomMealPlan, aiMealPlan, consumedFoods);
  }, [selectedMeal, customMealPlan, aiMealPlan, consumedFoods, saveMealDataToFirestore]);

  const removeFoodFromMeal = useCallback(async (foodId: string, mealType: MealType) => {
    const newCustomMealPlan = { 
      ...customMealPlan, 
      [mealType]: customMealPlan[mealType].filter(f => f.id !== foodId) 
    };
    const uniqueId = getFoodUniqueId(foodId, mealType, currentDate);
    const newConsumed = consumedFoods.filter(id => id !== uniqueId);

    setCustomMealPlan(newCustomMealPlan);
    setConsumedFoods(newConsumed);
    await saveMealDataToFirestore(newCustomMealPlan, aiMealPlan, newConsumed);
  }, [currentDate, customMealPlan, aiMealPlan, consumedFoods, saveMealDataToFirestore]);


  // --- DATA FETCHING EFFECTS (REFACTORED) ---
  // PROBLEM 2 FIX: This `useEffect` reliably listens for auth state changes.
  useEffect(() => {
    setIsDataLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        try {
          const userProfile = await getUserProfile(firebaseUser.uid);
          if (userProfile) {
            setUser(userProfile as User);
          } else {
            // This case should be handled by the onboarding flow, but as a fallback:
            setUser(null);
            console.warn("User authenticated but no profile found.");
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          setUser(null);
        }
      } else {
        setAuthUser(null);
        setUser(null);
        setIsDataLoading(false);
      }
    });
    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  // This useEffect now reliably fetches daily data when auth state or date changes.
  useEffect(() => {
    // PROBLEM 3 FIX: Don't run if authUser (and thus user profile) is not loaded yet.
    if (!authUser || !user) {
        if(!isDataLoading && !authUser) { // Only set loading to false if we are sure we are logged out
            setIsDataLoading(false);
        }
        return;
    }

    const loadDailyData = async () => {
      setIsDataLoading(true);
      const dateKey = getDateKey(currentDate);
      
      try {
        const data: any = await fetchUserLogByDate('meal', dateKey);

        if (data && Array.isArray(data.foods)) {
          const newCustomPlan: { [key in MealType]: Food[] } = { Sarapan: [], MakanSiang: [], MakanMalam: [], snacks: [] };
          const newAiItems: { [key in MealType]: AIMeal[] } = { Sarapan: [], MakanSiang: [], MakanMalam: [], snacks: [] };
          const newConsumed: string[] = [];
          let hasAiItems = false;

          data.foods.forEach((f: any) => {
            const mealType = f.mealType as MealType;
            if (!mealType || !MEAL_TYPES.includes(mealType)) return;

            const fId = f.id || `restored-${Math.random()}`;
            if (f.consumed) {
              newConsumed.push(getFoodUniqueId(fId, mealType, currentDate));
            }

            if (f.source === 'ai') {
              hasAiItems = true;
              newAiItems[mealType].push({ ...f, menu: f.name, id: fId });
            } else {
              newCustomPlan[mealType].push({ ...f, servingSize: f.portions || f.servingSize, id: fId });
            }
          });

          setCustomMealPlan(newCustomPlan);
          setConsumedFoods(newConsumed);
          if (hasAiItems) {
            setAiMealPlan({
              Sarapan: newAiItems.Sarapan,
              MakanSiang: newAiItems.MakanSiang,
              MakanMalam: newAiItems.MakanMalam,
              snacks: newAiItems.snacks,
              totalCalories: data.totalCalories || 0,
              nutritionTips: data.nutritionTips || '',
              hydrationGoal: data.hydrationGoal || ''
            });
          } else {
            setAiMealPlan(null);
          }
        } else {
          // If no data for the day, reset the state
          setConsumedFoods([]);
          setCustomMealPlan({ Sarapan: [], MakanSiang: [], MakanMalam: [], snacks: [] });
          setAiMealPlan(null);
        }
      } catch (error) {
        console.error("Error loading meal log:", error);
        // Reset state on error to avoid showing stale data
        setConsumedFoods([]);
        setCustomMealPlan({ Sarapan: [], MakanSiang: [], MakanMalam: [], snacks: [] });
        setAiMealPlan(null);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadDailyData();
  }, [authUser, user, currentDate]); // Re-fetch when user or date changes

  // PROBLEM 1 FIX: This useEffect now uses a ref to compare previous and current nutrition
  // values, preventing the infinite loop.
  const prevConsumedNutritionRef = useRef(nutrition);
  useEffect(() => {
    if (user) {
        const newNutritionData = {
            date: getDateKey(currentDate),
            calories: consumedNutrition.calories,
            protein: consumedNutrition.protein,
            carbs: consumedNutrition.carbs,
            fat: consumedNutrition.fat,
        };
        // Use a deep comparison to see if the object's values have actually changed.
        if (!isEqual(prevConsumedNutritionRef.current, newNutritionData)) {
            updateNutrition(newNutritionData);
            prevConsumedNutritionRef.current = newNutritionData;
        }
    }
  }, [user, consumedNutrition, currentDate, updateNutrition]);

  /**
   * Rombak Total: Menggunakan KNN Mandiri daripada Groq AI
   */
  const generateKNNMealPlan = useCallback(async (): Promise<void> => {
    if (!user) {
        setAiError("User profile not loaded. Cannot generate meal plan.");
        return;
    }
    setIsLoadingAI(true);
    setAiError(null);

    try {
      const targetDaily = calculateTDEE(user);
      const mealTargetRatios: Record<MealTimeCategory, number> = {
        Sarapan: 0.25,
        MakanSiang: 0.35,
        MakanMalam: 0.30,
        snacks: 0.10
      };
      const getMealTarget = (mealType: MealTimeCategory) => Math.max(40, Math.round(targetDaily * mealTargetRatios[mealType]));

      const shuffle = <T,>(items: T[]): T[] => {
        const array = [...items];
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };

      const randomRange = (base: number, minFactor: number, maxFactor: number) => {
        const factor = minFactor + Math.random() * (maxFactor - minFactor);
        return Math.max(40, Math.round(base * factor));
      };

      const buildReasoning = (item: FoodItem, calories: number, mealType: string) => {
        const goalText = user.goal === 'lose-weight'
          ? 'lebih ringan dan cocok untuk mengelola kalori hari ini'
          : user.goal === 'muscle-gain' || user.goal === 'build-muscle'
            ? 'tinggi protein untuk mendukung otot'
            : 'seimbang untuk energi yang nyaman';

        return `Menu acak ini dipilih dari kandidat terdekat sekitar ${calories} kcal untuk ${mealType.toLowerCase()} dan ${goalText}.`;
      };

      const makeItems = (baseCalories: number, mealType: MealTimeCategory) => {
        const randomCalories = randomRange(baseCalories, 0.7, 1.0);
        const topK = getFoodRecommendationsKNN(randomCalories, user.goal, mealType, 20, 3, user.allergies ?? [], false);
        const [item] = shuffle(topK).slice(0, 1);
        const finalCalories = item?.calories ?? randomCalories;

        return [{
          ...item,
          menu: item?.name ?? 'Makanan acak',
          calories: finalCalories,
          protein: item?.protein ?? 0,
          carbs: item?.carbs ?? 0,
          fat: item?.fat ?? 0,
          time: mealType === 'Sarapan' ? 'Pagi' : mealType === 'MakanSiang' ? 'Siang' : mealType === 'MakanMalam' ? 'Malam' : 'Snack',
          portions: '1 Porsi',
          reasoning: buildReasoning(item ?? { name: 'Makanan acak', calories: finalCalories, protein: 0, carbs: 0, fat: 0 }, finalCalories, mealType),
        }];
      };

      const breakfast = makeItems(getMealTarget('Sarapan'), 'Sarapan');
      const lunch = makeItems(getMealTarget('MakanSiang'), 'MakanSiang');
      const dinner = makeItems(getMealTarget('MakanMalam'), 'MakanMalam');
      const snacks = makeItems(getMealTarget('snacks'), 'snacks');
      const totalCalories = breakfast[0].calories + lunch[0].calories + dinner[0].calories + snacks[0].calories;

      const recommendations = {
        Sarapan: breakfast,
        MakanSiang: lunch,
        MakanMalam: dinner,
        snacks: snacks,
        totalCalories,
        nutritionTips: `Menu hari ini dibuat secara acak dan dipilih untuk berada di bawah target agar Anda bisa menambah makanan jika perlu. Total kalori sekitar ${totalCalories} kcal.`,
        hydrationGoal: "8 Gelas (2.5L)"
      };

      await new Promise(res => setTimeout(res, 800));

      const normalized = normalizeAIMealPlan(recommendations);
      setAiMealPlan(normalized);
      await saveMealDataToFirestore(customMealPlan, normalized, consumedFoods);

    } catch (err: any) {
      console.error("AI Error:", err);
      setAiError("Gagal menyusun menu. KNN gagal menghasilkan rekomendasi yang valid. Silakan coba lagi.");
    } finally {
      setIsLoadingAI(false);
    }
  }, [user, customMealPlan, consumedFoods, saveMealDataToFirestore]);
  
  const handleRefreshMenu = useCallback(async () => {
    const newConsumed = consumedFoods.filter(id => !id.startsWith('ai-'));
    setAiMealPlan(null);
    setConsumedFoods(newConsumed);
    await saveMealDataToFirestore(customMealPlan, null, newConsumed);
    await generateKNNMealPlan();
  }, [generateKNNMealPlan, consumedFoods, customMealPlan, saveMealDataToFirestore]);
  
  // --- RENDER LOGIC ---
  if (isDataLoading) {
      return <div className="min-h-screen bg-gray-50 py-8 flex justify-center items-center"><Loader className="animate-spin text-green-500" size={40} /></div>;
  }
  
  // PROBLEM 2 FIX: This loading state is now more accurate.
  if (!authUser || !user) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 flex flex-col justify-center items-center">
            <p className="text-gray-600">Please log in to view your meal plan.</p>
            {/* Optionally add a link to the login page */}
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header and Date Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Rencana Makan</h1>
          <div className="flex items-center bg-white shadow-sm rounded-lg p-1">
            <button onClick={() => setCurrentDate(d => new Date(d.getTime() - 86400000))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
            <span className="px-4 font-semibold w-32 text-center">{currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
            <button onClick={() => setCurrentDate(d => new Date(d.getTime() + 86400000))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
          </div>
        </div>

        {/* AI Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
          {!aiMealPlan && !isLoadingAI && (
             <button onClick={generateKNNMealPlan} className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 transition-all font-medium flex items-center gap-2">
                <Sparkles size={18}/> Buat Rekomendasi ML
             </button>
          )}
          {aiMealPlan && !isLoadingAI && (
            <button onClick={handleRefreshMenu} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors">
              <RefreshCw size={16} /> Ganti Menu
            </button>
          )}
        </div>
        
        {/* Nutrition Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
            <div className="mb-6">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Target</p><p className="text-lg md:text-xl font-bold text-gray-900">{user.dailyCalories}</p><p className="text-xs text-gray-400">kcal</p></div>
                    <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Masuk</p><p className="text-lg md:text-xl font-bold text-green-600">{Math.round(consumedNutrition.calories)}</p><p className="text-xs text-gray-400">kcal</p></div>
                    <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Sisa</p><p className="text-lg md:text-xl font-bold text-blue-600">{Math.max(0, user.dailyCalories - consumedNutrition.calories)}</p><p className="text-xs text-gray-400">kcal</p></div>
                    <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Progress</p><p className="text-lg md:text-xl font-bold text-gray-900">{Math.round(calorieProgress)}%</p><p className="text-xs text-gray-400">dari target</p></div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${calorieProgress}%` }} /></div>
            </div>
            <div className="border-t pt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Rincian Makronutrisi</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><div className="flex justify-between mb-2"><span className="text-sm font-medium text-gray-700">Protein</span><span className="text-sm font-bold text-orange-600">{consumedNutrition.protein.toFixed(1)}g</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (consumedNutrition.protein / (user.weight * 1.5)) * 100)}%` }} /></div></div>
                    <div><div className="flex justify-between mb-2"><span className="text-sm font-medium text-gray-700">Kalori</span><span className="text-sm font-bold text-blue-600">{consumedNutrition.calories.toFixed(1)} kcal</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (consumedNutrition.calories / user.dailyCalories) * 100)}%` }} /></div></div>
                    <div><div className="flex justify-between mb-2"><span className="text-sm font-medium text-gray-700">Gula</span><span className="text-sm font-bold text-pink-600">{consumedNutrition.sugars.toFixed(1)}g</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-pink-500" style={{ width: `${Math.min(100, (consumedNutrition.sugars / Math.max(1, user.dailyCalories * 0.06 / 4)) * 100)}%` }} /></div></div>
                </div>
            </div>
        </div>

        {/* Meal Sections */}
        {isLoadingAI ? (
            <div className="flex flex-col items-center justify-center py-20"><Loader className="animate-spin text-green-500 mb-4" size={40} /><p className="text-gray-500 text-sm">Meracik menu spesial...</p></div>
        ) : aiError ? (
            <div className="text-center p-8 bg-red-50 rounded-xl text-red-600"><p>{aiError}</p><button onClick={generateKNNMealPlan} className="mt-2 font-bold underline">Coba Lagi</button></div>
        ) : (
          <div className="space-y-10 pb-20">
            {MEAL_TYPES.map((type) => {
              const aiItems = aiMealPlan ? (aiMealPlan[type] || []) : [];
              const manualItems = customMealPlan[type] || [];
              const allItems = [...aiItems, ...manualItems];
              
              return (
                 <div key={type} className="w-full">
                    <div className="flex items-center justify-between px-1 mb-4">
                        <div><h3 className="text-xl font-bold text-gray-900 capitalize tracking-tight">{type.replace(/([A-Z])/g, ' $1').trim()}</h3><p className="text-xs text-gray-500 font-medium">{type === 'Sarapan' ? 'Energy for the day' : type === 'MakanSiang' ? 'Power up your afternoon' : type === 'MakanMalam' ? 'Recovery & rest' : 'Healthy bites'}</p></div>
                        <button onClick={() => { setSelectedMeal(type); setShowFoodSelector(true); }} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"><Plus size={18} /></button>
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-6 px-1 -mx-1 snap-x">
                       {allItems.length > 0 ? allItems.map((meal: any, idx) => {
                          const isAi = !!meal.reasoning;
                          const isDone = meal.id ? isFoodConsumed(meal.id, type) : false;
                          return (
                            <div key={`${type}-${meal.id}-${idx}`} className={`snap-center shrink-0 w-[280px] bg-white rounded-2xl p-5 border transition-all duration-300 relative group flex flex-col ${isDone ? 'border-green-200 bg-green-50/30' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-green-200'}`}>
                               <div className="flex justify-between items-start mb-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${isAi ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{isAi ? `Rekomendasi` : 'Manual'}</span>{!isAi && (<button onClick={() => removeFoodFromMeal(meal.id, type)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>)}</div>
                               <div className="mb-4 flex-1"><h4 className={`font-bold text-gray-900 text-lg leading-tight mb-1 h-10 line-clamp-2 ${isDone ? 'line-through text-gray-400' : ''}`}>{meal.menu || meal.name}</h4><div className="flex items-center gap-2 text-xs text-gray-500"><span className="flex items-center gap-1"><Sparkles size={10} className="text-yellow-500"/> {meal.calories} kcal</span><span>•</span><span>{meal.time || 'Anytime'}</span></div><p className="text-xs text-gray-400 mt-2 line-clamp-2 h-8">{meal.portions || meal.servingSize || "1 Porsi"}</p></div>
                               <div className="grid grid-cols-3 gap-2 mb-4">
                                  <div className="bg-blue-50 rounded-xl p-2 text-center"><span className="block text-[10px] text-gray-400 font-bold uppercase">Protein</span><span className="block text-xs font-bold text-gray-700">{meal.protein || 0}g</span></div>
                                  <div className="bg-gray-50 rounded-xl p-2 text-center"><span className="block text-[10px] text-gray-400 font-bold uppercase">Kalori</span><span className="block text-xs font-bold text-gray-700">{meal.calories || 0} kcal</span></div>
                                  <div className="bg-pink-50 rounded-xl p-2 text-center"><span className="block text-[10px] text-gray-400 font-bold uppercase">Gula</span><span className="block text-xs font-bold text-gray-700">{meal.sugars !== undefined ? meal.sugars : meal.carbs || 0}g</span></div>
                               </div>
                               <div className="grid grid-cols-2 gap-2 mb-3 text-[10px] text-gray-500">
                                  {meal.dietaryFiber !== undefined && <div className="bg-slate-50 rounded-xl p-2 text-center"><span className="block uppercase">Fiber</span><span className="block font-bold text-gray-700">{meal.dietaryFiber}g</span></div>}
                                  {meal.sugars !== undefined && <div className="bg-slate-50 rounded-xl p-2 text-center"><span className="block uppercase">Gula</span><span className="block font-bold text-gray-700">{meal.sugars}g</span></div>}
                                  {meal.sodium !== undefined && <div className="bg-slate-50 rounded-xl p-2 text-center"><span className="block uppercase">Na</span><span className="block font-bold text-gray-700">{meal.sodium}g</span></div>}
                                  {meal.saturatedFat !== undefined && <div className="bg-slate-50 rounded-xl p-2 text-center"><span className="block uppercase">Sat Fat</span><span className="block font-bold text-gray-700">{meal.saturatedFat}g</span></div>}
                               </div>
                               <button onClick={() => meal.id && toggleFoodConsumed(meal.id, type)} className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all h-10 whitespace-nowrap mt-auto ${isDone ? 'bg-green-500 text-white shadow-green-200 shadow-lg' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'}`}>{isDone ? <><Check size={14} /> Selesai</> : 'Tandai Selesai'}</button>
                            </div>
                          );
                       }) : (
                          <div className="w-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50"><p className="text-sm text-gray-400 font-medium">Belum ada rencana makan</p><button onClick={() => { setSelectedMeal(type); setShowFoodSelector(true); }} className="mt-2 text-xs text-green-600 font-bold hover:underline">+ Tambah Makanan</button></div>
                       )}
                    </div>
                 </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showFoodSelector && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">Cari Makanan</h3>
                  <p className="text-xs text-gray-500">Menambahkan ke: <span className="text-green-600 font-bold uppercase">{selectedMeal}</span></p>
                </div>
                <button onClick={() => setShowFoodSelector(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
              </div>
              <div className="p-4 overflow-y-auto">
                <AISearch 
                  allergies={user.allergies ?? []}
                  onSelectFood={(food) => { 
                    addFoodToMeal(food); 
                    setShowFoodSelector(false); 
                  }} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealPlanning;

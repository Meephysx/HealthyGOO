/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HealthyGO KNN Machine Learning Service
 * Menangani kalkulasi TDEE dan Rekomendasi Mandiri (Client-side)
 */

// Import dataset JSON (Pastikan kamu sudah mengonversi .csv ke .json di folder data)
import rawFoodData1 from '../data/FOOD-DATA-GROUP1';
import rawFoodData2 from '../data/FOOD-DATA-GROUP2';
import rawFoodData3 from '../data/FOOD-DATA-GROUP3';
import rawFoodData4 from '../data/FOOD-DATA-GROUP4';
import rawFoodData5 from '../data/FOOD-DATA-GROUP5';
import rawIndonesianFood from '../data/nutrition';

export interface FoodItem {
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
  isIndonesian?: boolean;
}

export interface ExerciseItem {
  name: string;
  caloriesBurnedPerMinute: number;
  intensity: 'Low' | 'Medium' | 'High';
}

/**
 * MAPPING DATASET MAKANAN
 * Membersihkan data dari nilai non-numerik (NaN) yang sering muncul dari konversi CSV
 */
const combinedRawData = [
  ...(rawFoodData1 as any[]),
  ...(rawFoodData2 as any[]),
  ...(rawFoodData3 as any[]),
  ...(rawFoodData4 as any[]),
  ...(rawFoodData5 as any[])
];

// Process Indonesian foods with isIndonesian flag
const processIndonesianFoods = (indonesianData: any[]): FoodItem[] => {
  return indonesianData.map((item) => {
    const cleanNum = (val: any) => (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
    return {
      name: item.name || "Makanan Indonesia",
      calories: Math.round(cleanNum(item.calories || item['Caloric Value'])),
      protein: Number(cleanNum(item.proteins || item.protein || item.Protein || 0).toFixed(1)),
      carbs: Number(cleanNum(item.carbohydrate || item.carbohydrates || item.Carbohydrates || 0).toFixed(1)),
      fat: Number(cleanNum(item.fat || item.Fat || 0).toFixed(1)),
      saturatedFat: Number(cleanNum(item.saturatedFat || item['Saturated Fats'] || 0).toFixed(1)),
      monounsaturatedFat: Number(cleanNum(item.monounsaturatedFat || item['Monounsaturated Fats'] || 0).toFixed(1)),
      polyunsaturatedFat: Number(cleanNum(item.polyunsaturatedFat || item['Polyunsaturated Fats'] || 0).toFixed(1)),
      sugars: Number(cleanNum(item.sugars || item.Sugars || 0).toFixed(1)),
      dietaryFiber: Number(cleanNum(item.dietaryFiber || item['Dietary Fiber'] || 0).toFixed(1)),
      cholesterol: Number(cleanNum(item.cholesterol || item.Cholesterol || 0).toFixed(1)),
      sodium: Number(cleanNum(item.sodium || item.Sodium || 0).toFixed(3)),
      servingSize: "100g",
      isIndonesian: true
    };
  });
};

export const FOOD_DATASET: FoodItem[] = [
  // Include processed Indonesian foods first
  ...processIndonesianFoods(rawIndonesianFood as any[]),
  // Then include other foods
  ...combinedRawData.map((item) => {
    const cleanNum = (val: any) => (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
    return {
      name: item.food || "Unknown Food",
      // Dibulatkan agar tidak muncul angka desimal yang sangat panjang di UI
      calories: Math.round(cleanNum(item['Caloric Value'] || item['calories'])),
      protein: Number(cleanNum(item.Protein || item.protein).toFixed(1)),
      carbs: Number(cleanNum(item.Carbohydrates || item.carbohydrates).toFixed(1)),
      fat: Number(cleanNum(item.Fat || item.fat).toFixed(1)),
      saturatedFat: Number(cleanNum(item['Saturated Fats'] || item.saturatedFat || 0).toFixed(1)),
      monounsaturatedFat: Number(cleanNum(item['Monounsaturated Fats'] || item.monounsaturatedFat || 0).toFixed(1)),
      polyunsaturatedFat: Number(cleanNum(item['Polyunsaturated Fats'] || item.polyunsaturatedFat || 0).toFixed(1)),
      sugars: Number(cleanNum(item.Sugars || item.sugars || 0).toFixed(1)),
      dietaryFiber: Number(cleanNum(item['Dietary Fiber'] || item.dietaryFiber || 0).toFixed(1)),
      cholesterol: Number(cleanNum(item.Cholesterol || item.cholesterol || 0).toFixed(1)),
      sodium: Number(cleanNum(item.Sodium || item.sodium || 0).toFixed(3)),
      servingSize: "100g",
      isIndonesian: false
    };
  })
];

// DATASET OLAHRAGA
export const EXERCISE_DATASET: ExerciseItem[] = [
  { name: "Lari Cepat (Running)", caloriesBurnedPerMinute: 12, intensity: 'High' },
  { name: "Bersepeda Santai", caloriesBurnedPerMinute: 6, intensity: 'Low' },
  { name: "Angkat Beban (Weightlifting)", caloriesBurnedPerMinute: 8, intensity: 'Medium' },
  { name: "Berenang", caloriesBurnedPerMinute: 10, intensity: 'High' },
  { name: "Yoga", caloriesBurnedPerMinute: 3, intensity: 'Low' },
  { name: "HIIT Workout", caloriesBurnedPerMinute: 15, intensity: 'High' },
];

/**
 * 1. Kalkulasi TDEE (Mifflin-St Jeor)
 */
export const calculateTDEE = (user: {
  weight: number;
  height: number;
  age: number;
  gender: string;
  goal: string;
  activityLevel: string;
}) => {
  let bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age;
  bmr = user.gender === 'male' ? bmr + 5 : bmr - 161;

  const activityMultipliers: Record<string, number> = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very-active': 1.9
  };

  const tdee = bmr * (activityMultipliers[user.activityLevel] || 1.2);
  
  // Penyesuaian berdasarkan Goal
  if (user.goal === 'lose-weight') return Math.round(tdee - 500);
  if (user.goal === 'muscle-gain' || user.goal === 'gain-weight') return Math.round(tdee + 300);
  return Math.round(tdee);
};

/**
 * 2. KNN untuk Rekomendasi Makanan
 * Sekarang menggunakan Multi-Feature Matching (Kalori + Gula)
 */
export type MealTimeCategory = 'Sarapan' | 'MakanSiang' | 'MakanMalam' | 'snacks';

const mealCategoryKeywords: Record<MealTimeCategory, string[]> = {
  Sarapan: ['oat', 'roti', 'telur', 'pancake', 'sereal', 'granola', 'yogurt', 'smoothie', 'banana', 'sarapan', 'cereal', 'porridge', 'bagel', 'toast'],
  MakanSiang: ['nasi', 'lunch', 'ayam', 'sandwich', 'salad', 'soup', 'pasta', 'steak', 'burger', 'rice', 'chicken', 'fish', 'tuna', 'tempeh', 'mie', 'spaghetti'],
  MakanMalam: ['makan malam', 'dinner', 'salmon', 'steak', 'curry', 'soup', 'pasta', 'rice', 'salad', 'fish', 'chicken', 'potato', 'beef', 'seafood'],
  snacks: ['snack', 'cookie', 'bar', 'kacang', 'fruit', 'buah', 'yogurt', 'juice', 'cracker', 'granola', 'chips', 'ice cream', 'bread', 'biscuit']
};

const normalizeName = (name: string) => name.toLowerCase();

const allergyKeywords: Record<string, string[]> = {
  fish: ['fish', 'salmon', 'tuna', 'cod', 'trout', 'swordfish', 'herring', 'mackerel', 'anchovy', 'pollock', 'bass', 'catfish', 'tilapia', 'shrimp', 'prawn', 'crab', 'lobster', 'seafood', 'caviar', 'octopus', 'squid', 'shellfish', 'fish sauce'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop', 'shellfish'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'custard', 'whey', 'ghee'],
  nuts: ['almond', 'walnut', 'cashew', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'peanut', 'nut'],
  wheat: ['bread', 'wheat', 'flour', 'pasta', 'noodle', 'cracker', 'cereal', 'bun', 'bagel', 'tortilla'],
  soy: ['soy', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soya'],
  eggs: ['egg', 'omelet', 'omelette', 'mayonnaise', 'meringue'],
  sesame: ['sesame', 'tahini', 'tahini oil', 'sesame oil']
};

const matchesMealCategory = (item: FoodItem, category: MealTimeCategory): boolean => {
  const normalized = normalizeName(item.name);
  return mealCategoryKeywords[category].some(keyword => normalized.includes(keyword));
};

export const filterFoodItemsByAllergies = (items: FoodItem[], allergies: string[] = []): FoodItem[] => {
  if (!allergies || allergies.length === 0) return items;
  const normalizedAllergies = allergies.map(a => a.trim().toLowerCase());

  return items.filter(item => {
    const name = normalizeName(item.name);
    return normalizedAllergies.every(allergy => {
      const keywords = allergyKeywords[allergy] || [];
      return !keywords.some(keyword => name.includes(keyword));
    });
  });
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const getFoodRecommendationsKNN = (
  targetCalories: number,
  goal: string,
  mealCategory: MealTimeCategory,
  poolSize: number = 20,
  resultCount: number = 3,
  allergies: string[] = [],
  allowAboveTarget: boolean = true
): FoodItem[] => {
  const targetSugar = Math.max(5, (targetCalories * 0.06) / 4);
  const targetProtein = (targetCalories * 0.2) / 4;
  const targetFat = (targetCalories * 0.25) / 9;

  const dataPool = filterFoodItemsByAllergies(FOOD_DATASET, allergies);
  const scoredItems = dataPool.map(item => {
    const sugarValue = typeof item.sugars === 'number' ? item.sugars : item.carbs;
    const calDiff = Math.abs(item.calories - targetCalories);
    const sugarDiff = Math.abs(sugarValue - targetSugar);
    const proteinDiff = Math.abs(item.protein - targetProtein);
    const fatDiff = Math.abs(item.fat - targetFat);

    let score = calDiff + sugarDiff * 1.5 + proteinDiff * 1 + fatDiff * 0.8;

    // Bonus for Indonesian foods: reduce score (lower = better)
    if (item.isIndonesian) {
      score *= 0.7; // 30% bonus/discount on score for Indonesian foods
    }

    if (goal === 'muscle-gain' || goal === 'build-muscle') {
      score -= item.protein * 3.5;
    }

    if (goal === 'lose-weight' || goal === 'weight-loss') {
      score += item.calories * 0.05;
    }

    return { ...item, score };
  });

  const nearestPool = scoredItems
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.min(poolSize, scoredItems.length));

  const categoryPool = nearestPool.filter(item => matchesMealCategory(item, mealCategory));
  const finalPool = categoryPool.length >= resultCount ? categoryPool : nearestPool;

  const selectionPool = allowAboveTarget
    ? finalPool
    : finalPool.filter(item => item.calories <= targetCalories);

  const outputPool = selectionPool.length > 0 ? selectionPool : finalPool;

  // Separate Indonesian and non-Indonesian foods
  const indonesianFoods = outputPool.filter(item => item.isIndonesian);
  const nonIndonesianFoods = outputPool.filter(item => !item.isIndonesian);

  // Strategy: Prioritize Indonesian foods (70% if available)
  const indonesianCount = Math.ceil((resultCount * 70) / 100); // 70% prioritas Indonesia
  const diversityCount = resultCount - indonesianCount; // Sisanya untuk diversity

  const selected: (FoodItem & { score: number })[] = [];

  // Add Indonesian foods first
  const indonesianToAdd = shuffleArray(indonesianFoods).slice(0, indonesianCount);
  selected.push(...indonesianToAdd);

  // Fill remaining with non-Indonesian for diversity (if needed)
  if (selected.length < resultCount) {
    const remainingNeeded = resultCount - selected.length;
    const nonIndonesianToAdd = shuffleArray(nonIndonesianFoods).slice(0, remainingNeeded);
    selected.push(...nonIndonesianToAdd);
  }

  // If still not enough, add more from Indonesian pool
  if (selected.length < resultCount) {
    const remainingNeeded = resultCount - selected.length;
    const moreIndonesian = shuffleArray(
      indonesianFoods.filter(food => !selected.some(s => s.name === food.name))
    ).slice(0, remainingNeeded);
    selected.push(...moreIndonesian);
  }

  return shuffleArray(selected)
    .slice(0, resultCount)
    .map(({ score, ...item }) => item);
};

/**
 * 3. KNN untuk Rekomendasi Olahraga
 */
export const getExerciseRecommendationsKNN = (
  targetDeficit: number,
  poolSize: number = 10,
  resultCount: number = 3
): ExerciseItem[] => {
  const scoredExercises = EXERCISE_DATASET.map(exercise => {
    const estimatedBurn = exercise.caloriesBurnedPerMinute * 30;
    const distance = Math.abs(estimatedBurn - targetDeficit);
    return { ...exercise, distance };
  });

  const nearestExercises = scoredExercises
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(poolSize, scoredExercises.length));

  return shuffleArray(nearestExercises)
    .slice(0, Math.min(resultCount, nearestExercises.length))
    .map(({ distance, ...exercise }) => exercise);
};
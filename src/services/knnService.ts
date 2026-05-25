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

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
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

export const FOOD_DATASET: FoodItem[] = combinedRawData.map((item) => {
  const cleanNum = (val: any) => (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
  return {
    name: item.food || "Unknown Food",
    // Dibulatkan agar tidak muncul angka desimal yang sangat panjang di UI
    calories: Math.round(cleanNum(item['Caloric Value'] || item['calories'])),
    protein: Number(cleanNum(item.Protein || item.protein).toFixed(1)),
    carbs: Number(cleanNum(item.Carbohydrates || item.carbohydrates).toFixed(1)),
    fat: Number(cleanNum(item.Fat || item.fat).toFixed(1)),
    servingSize: "100g" 
  };
});

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
 * Sekarang menggunakan Multi-Feature Matching (Kalori + Karbohidrat)
 */
export type MealTimeCategory = 'Sarapan' | 'MakanSiang' | 'MakanMalam' | 'snacks';

const mealCategoryKeywords: Record<MealTimeCategory, string[]> = {
  Sarapan: ['oat', 'roti', 'telur', 'pancake', 'sereal', 'granola', 'yogurt', 'smoothie', 'banana', 'sarapan', 'cereal', 'porridge', 'bagel', 'toast'],
  MakanSiang: ['nasi', 'lunch', 'ayam', 'sandwich', 'salad', 'soup', 'pasta', 'steak', 'burger', 'rice', 'chicken', 'fish', 'tuna', 'tempeh', 'mie', 'spaghetti'],
  MakanMalam: ['makan malam', 'dinner', 'salmon', 'steak', 'curry', 'soup', 'pasta', 'rice', 'salad', 'fish', 'chicken', 'potato', 'beef', 'seafood'],
  snacks: ['snack', 'cookie', 'bar', 'kacang', 'fruit', 'buah', 'yogurt', 'juice', 'cracker', 'granola', 'chips', 'ice cream', 'bread', 'biscuit']
};

const normalizeName = (name: string) => name.toLowerCase();

const matchesMealCategory = (item: FoodItem, category: MealTimeCategory): boolean => {
  const normalized = normalizeName(item.name);
  return mealCategoryKeywords[category].some(keyword => normalized.includes(keyword));
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
  resultCount: number = 3
): FoodItem[] => {
  const targetCarbs = (targetCalories * 0.5) / 4;
  const targetProtein = (targetCalories * 0.2) / 4;
  const targetFat = (targetCalories * 0.25) / 9;

  const scoredItems = FOOD_DATASET.map(item => {
    const calDiff = Math.abs(item.calories - targetCalories);
    const carbDiff = Math.abs(item.carbs - targetCarbs);
    const proteinDiff = Math.abs(item.protein - targetProtein);
    const fatDiff = Math.abs(item.fat - targetFat);

    let score = calDiff + carbDiff * 1.5 + proteinDiff * 1 + fatDiff * 0.8;

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

  return shuffleArray(finalPool)
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
export interface User {
  fullname: string;
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  age: number;
  gender: 'male' | 'female';
  height: number; // in cm
  weight: number; // in kg
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  goal: 'weight-loss' | 'weight-gain' | 'muscle-gain';
  dietaryRestrictions: string[];
  allergies: string[];
  bmi: number;
  idealWeight: number;
  dailyCalories: number;
  createdAt: Date;
}

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingSize: string;
  category: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  date: string;
  breakfast: Food[];
  lunch: Food[];
  dinner: Food[];
  snacks: Food[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: number; // in minutes
  caloriesBurned: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  instructions: string[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  date: string;
  exercises: Exercise[];
  totalDuration: number;
  totalCaloriesBurned: number;
  completed: boolean;
}

export interface ProgressEntry {
  id: string;
  userId: string;
  date: string;
  weight: number;
  bodyFat?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  notes?: string;
}


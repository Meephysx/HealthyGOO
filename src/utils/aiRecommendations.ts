import { SAMPLE_FOODS, SAMPLE_EXERCISES } from './constants';
import type { User, Food, Exercise } from '../types';

export interface MealRecommendation {
  meal: 'breakfast' | 'lunch' | 'dinner';
  foods: Food[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  reasoning: string;
}

export interface WorkoutRecommendation {
  exercises: Exercise[];
  totalDuration: number;
  totalCalories: number;
  reasoning: string;
  restDays: string[];
}

export const generateMealRecommendations = (user: User): MealRecommendation[] => {
  const targetCalories = user.dailyCalories;
  const breakfastCalories = Math.round(targetCalories * 0.25);
  const lunchCalories = Math.round(targetCalories * 0.35);
  const dinnerCalories = Math.round(targetCalories * 0.30);

  // Filter foods based on dietary restrictions
  const availableFoods = SAMPLE_FOODS.filter(food => {
    if (user.dietaryRestrictions.includes('Vegetarian') && 
        ['Grilled Chicken Breast', 'Salmon Fillet'].includes(food.name)) return false;
    if (user.dietaryRestrictions.includes('Vegan') && 
        ['Grilled Chicken Breast', 'Salmon Fillet', 'Greek Yogurt'].includes(food.name)) return false;
    if (user.dietaryRestrictions.includes('Dairy-Free') && 
        food.name === 'Greek Yogurt') return false;
    if (user.dietaryRestrictions.includes('Nuts') && 
        food.name === 'Almonds') return false;
    return true;
  });

  const recommendations: MealRecommendation[] = [];

  // Breakfast Recommendation
  const breakfastFoods = getOptimalFoodCombination(availableFoods, breakfastCalories, 'breakfast');
  const breakfastNutrition = calculateNutrition(breakfastFoods);
  recommendations.push({
    meal: 'breakfast',
    foods: breakfastFoods,
    ...breakfastNutrition,
    reasoning: getBreakfastReasoning(user, breakfastFoods)
  });

  // Lunch Recommendation
  const lunchFoods = getOptimalFoodCombination(availableFoods, lunchCalories, 'lunch');
  const lunchNutrition = calculateNutrition(lunchFoods);
  recommendations.push({
    meal: 'lunch',
    foods: lunchFoods,
    ...lunchNutrition,
    reasoning: getLunchReasoning(user, lunchFoods)
  });

  // Dinner Recommendation
  const dinnerFoods = getOptimalFoodCombination(availableFoods, dinnerCalories, 'dinner');
  const dinnerNutrition = calculateNutrition(dinnerFoods);
  recommendations.push({
    meal: 'dinner',
    foods: dinnerFoods,
    ...dinnerNutrition,
    reasoning: getDinnerReasoning(user, dinnerFoods)
  });

  return recommendations;
};

export const generateWorkoutRecommendation = (user: User): WorkoutRecommendation => {
  let exercises: Exercise[] = [];
  let reasoning = '';

  if (user.goal === 'weight-loss') {
    exercises = SAMPLE_EXERCISES.filter(ex => 
      ex.category === 'Cardio' || 
      (ex.category === 'Strength' && ex.difficulty === 'beginner')
    ).slice(0, 4);
    reasoning = `Cardio-focused workout to maximize calorie burn for weight loss. Combined with basic strength training to preserve muscle mass during your weight loss journey.`;
  } else if (user.goal === 'muscle-gain') {
    exercises = SAMPLE_EXERCISES.filter(ex => 
      ex.category === 'Strength'
    ).slice(0, 4);
    reasoning = `Strength-focused workout targeting major muscle groups. Progressive overload with compound movements to stimulate muscle growth and development.`;
  } else if (user.goal === 'weight-gain') {
    exercises = SAMPLE_EXERCISES.filter(ex => 
      ex.category === 'Strength' || ex.category === 'Flexibility'
    ).slice(0, 3);
    reasoning = `Moderate strength training to build healthy muscle mass while gaining weight. Includes flexibility work for overall wellness and injury prevention.`;
  }

  // Adjust difficulty based on activity level
  if (user.activityLevel === 'sedentary' || user.activityLevel === 'light') {
    exercises = exercises.filter(ex => ex.difficulty === 'beginner');
  } else if (user.activityLevel === 'very-active') {
    exercises = exercises.filter(ex => ex.difficulty !== 'beginner');
  }

  const totalDuration = exercises.reduce((sum, ex) => sum + ex.duration, 0);
  const totalCalories = exercises.reduce((sum, ex) => sum + ex.caloriesBurned, 0);

  return {
    exercises,
    totalDuration,
    totalCalories,
    reasoning,
    restDays: getRestDayRecommendations(user.activityLevel)
  };
};

export const intelligentSearch = (query: string, user: User): { foods: Food[]; exercises: Exercise[]; answer: string } => {
  const lowerQuery = query.toLowerCase();
  let foods: Food[] = [];
  let exercises: Exercise[] = [];
  let answer = '';

  // Post-workout protein search
  if (lowerQuery.includes('post-workout') && lowerQuery.includes('protein')) {
    const proteinAmount = extractNumber(query) || 30;
    foods = SAMPLE_FOODS.filter(food => food.protein >= proteinAmount * 0.7);
    answer = `Here are high-protein foods perfect for post-workout recovery. Aim for ${proteinAmount}g protein within 30 minutes after your workout to optimize muscle protein synthesis.`;
  }
  
  // Low-carb snack search
  else if (lowerQuery.includes('low-carb') && lowerQuery.includes('snack')) {
    const calorieLimit = extractNumber(query) || 200;
    foods = SAMPLE_FOODS.filter(food => 
      food.carbs <= 10 && 
      food.calories <= calorieLimit &&
      ['Nuts', 'Protein', 'Dairy'].includes(food.category)
    );
    answer = `These low-carb snacks will keep you satisfied without spiking blood sugar. Perfect for maintaining ketosis or reducing overall carb intake.`;
  }
  
  // Belly fat workouts
  else if (lowerQuery.includes('belly fat') || lowerQuery.includes('abs')) {
    exercises = SAMPLE_EXERCISES.filter(ex => 
      ex.category === 'Cardio' || 
      ex.name.toLowerCase().includes('core') ||
      ex.name.toLowerCase().includes('plank')
    );
    answer = `While spot reduction isn't possible, these exercises combine cardio for overall fat loss with core strengthening. Consistency with diet is key for reducing belly fat.`;
  }
  
  // High protein search
  else if (lowerQuery.includes('high protein')) {
    foods = SAMPLE_FOODS.filter(food => food.protein >= 15).sort((a, b) => b.protein - a.protein);
    answer = `These high-protein foods support muscle building, satiety, and metabolic health. Aim for 0.8-1g protein per kg body weight daily.`;
  }
  
  // Weight loss foods
  else if (lowerQuery.includes('weight loss') && lowerQuery.includes('food')) {
    foods = SAMPLE_FOODS.filter(food => 
      food.calories <= 150 && 
      (food.fiber >= 2 || food.protein >= 10)
    );
    answer = `These nutrient-dense, lower-calorie foods promote satiety and support weight loss through high fiber and protein content.`;
  }
  
  // Muscle gain foods
  else if (lowerQuery.includes('muscle gain') || lowerQuery.includes('bulking')) {
    foods = SAMPLE_FOODS.filter(food => 
      food.protein >= 15 || 
      (food.calories >= 200 && food.carbs >= 20)
    );
    answer = `These foods provide the protein and calories needed for muscle growth. Combine with progressive strength training for best results.`;
  }
  
  // Cardio workouts
  else if (lowerQuery.includes('cardio') || lowerQuery.includes('fat burn')) {
    exercises = SAMPLE_EXERCISES.filter(ex => ex.category === 'Cardio');
    answer = `Cardiovascular exercises improve heart health and burn calories efficiently. Aim for 150 minutes of moderate cardio weekly.`;
  }
  
  // Strength workouts
  else if (lowerQuery.includes('strength') || lowerQuery.includes('muscle')) {
    exercises = SAMPLE_EXERCISES.filter(ex => ex.category === 'Strength');
    answer = `Strength training builds muscle, increases metabolism, and improves bone density. Focus on progressive overload for continuous improvement.`;
  }
  
  // Default response
  else {
    foods = SAMPLE_FOODS.slice(0, 3);
    exercises = SAMPLE_EXERCISES.slice(0, 3);
    answer = `Here are some general recommendations. Try being more specific with your search, like "high protein post-workout" or "low-carb snacks under 200 calories".`;
  }

  return { foods, exercises, answer };
};

// Helper functions
const getOptimalFoodCombination = (foods: Food[], targetCalories: number, mealType: string): Food[] => {
  const combination: Food[] = [];
  let currentCalories = 0;

  // Meal-specific food preferences
  const mealPreferences = {
    breakfast: ['Greek Yogurt', 'Almonds'],
    lunch: ['Grilled Chicken Breast', 'Brown Rice', 'Broccoli'],
    dinner: ['Salmon Fillet', 'Sweet Potato', 'Spinach']
  };

  const preferredFoods = foods.filter(food => 
    mealPreferences[mealType as keyof typeof mealPreferences].some(pref => 
      food.name.includes(pref)
    )
  );

  // Add preferred foods first
  for (const food of preferredFoods) {
    if (currentCalories + food.calories <= targetCalories * 1.1) {
      combination.push(food);
      currentCalories += food.calories;
    }
  }

  // Fill remaining calories if needed
  if (currentCalories < targetCalories * 0.8) {
    const remainingFoods = foods.filter(food => !combination.includes(food));
    for (const food of remainingFoods) {
      if (currentCalories + food.calories <= targetCalories * 1.1) {
        combination.push(food);
        currentCalories += food.calories;
        break;
      }
    }
  }

  return combination.length > 0 ? combination : [foods[0]];
};

const calculateNutrition = (foods: Food[]) => {
  return foods.reduce((total, food) => ({
    totalCalories: total.totalCalories + food.calories,
    totalProtein: total.totalProtein + food.protein,
    totalCarbs: total.totalCarbs + food.carbs,
    totalFat: total.totalFat + food.fat
  }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });
};

const getBreakfastReasoning = (user: User, foods: Food[]): string => {
  const hasProtein = foods.some(food => food.protein >= 10);
  const hasCarbs = foods.some(food => food.carbs >= 15);
  
  let reasoning = "A balanced breakfast to kickstart your metabolism. ";
  
  if (hasProtein) reasoning += "High protein content supports muscle maintenance and satiety. ";
  if (hasCarbs) reasoning += "Complex carbohydrates provide sustained energy for your morning. ";
  
  if (user.goal === 'weight-loss') {
    reasoning += "Portion-controlled to support your weight loss goals while maintaining nutrition.";
  } else if (user.goal === 'muscle-gain') {
    reasoning += "Protein-rich to support muscle protein synthesis after your overnight fast.";
  }
  
  return reasoning;
};

const getLunchReasoning = (user: User, foods: Food[]): string => {
  let reasoning = "A substantial midday meal to maintain energy levels. ";
  
  const hasLeanProtein = foods.some(food => food.protein >= 20 && food.fat <= 10);
  const hasVeggies = foods.some(food => food.category === 'Vegetables');
  
  if (hasLeanProtein) reasoning += "Lean protein supports muscle maintenance and keeps you full. ";
  if (hasVeggies) reasoning += "Vegetables provide essential micronutrients and fiber. ";
  
  if (user.goal === 'weight-loss') {
    reasoning += "Balanced macros to prevent afternoon energy crashes while staying within calorie goals.";
  }
  
  return reasoning;
};

const getDinnerReasoning = (user: User, foods: Food[]): string => {
  let reasoning = "A satisfying evening meal to support recovery and preparation for tomorrow. ";
  
  const hasOmega3 = foods.some(food => food.name.includes('Salmon'));
  const hasComplexCarbs = foods.some(food => food.name.includes('Sweet Potato'));
  
  if (hasOmega3) reasoning += "Omega-3 fatty acids support heart health and reduce inflammation. ";
  if (hasComplexCarbs) reasoning += "Complex carbohydrates aid in muscle recovery and sleep quality. ";
  
  if (user.goal === 'muscle-gain') {
    reasoning += "Higher protein content supports overnight muscle protein synthesis.";
  }
  
  return reasoning;
};

const getRestDayRecommendations = (activityLevel: string): string[] => {
  if (activityLevel === 'sedentary' || activityLevel === 'light') {
    return ['Sunday', 'Wednesday', 'Friday'];
  } else if (activityLevel === 'moderate') {
    return ['Sunday', 'Thursday'];
  } else {
    return ['Sunday'];
  }
};

const extractNumber = (text: string): number | null => {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
};
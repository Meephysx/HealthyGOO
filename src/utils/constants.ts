export const SAMPLE_FOODS = [
  {
    id: '1',
    name: 'Grilled Chicken Breast',
    calories: 231,
    protein: 43.5,
    carbs: 0,
    fat: 5,
    fiber: 0,
    sugar: 0,
    sodium: 104,
    servingSize: '100g',
    category: 'Protein'
  },
  {
    id: '2',
    name: 'Brown Rice',
    calories: 216,
    protein: 5,
    carbs: 45,
    fat: 1.8,
    fiber: 3.5,
    sugar: 0.7,
    sodium: 7,
    servingSize: '100g',
    category: 'Carbohydrates'
  },
  {
    id: '3',
    name: 'Broccoli',
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
    fiber: 2.6,
    sugar: 1.5,
    sodium: 33,
    servingSize: '100g',
    category: 'Vegetables'
  },
  {
    id: '4',
    name: 'Salmon Fillet',
    calories: 208,
    protein: 22,
    carbs: 0,
    fat: 12,
    fiber: 0,
    sugar: 0,
    sodium: 59,
    servingSize: '100g',
    category: 'Protein'
  },
  {
    id: '5',
    name: 'Sweet Potato',
    calories: 86,
    protein: 1.6,
    carbs: 20,
    fat: 0.1,
    fiber: 3,
    sugar: 4.2,
    sodium: 7,
    servingSize: '100g',
    category: 'Carbohydrates'
  },
  {
    id: '6',
    name: 'Greek Yogurt',
    calories: 59,
    protein: 10,
    carbs: 3.6,
    fat: 0.4,
    fiber: 0,
    sugar: 3.2,
    sodium: 36,
    servingSize: '100g',
    category: 'Dairy'
  },
  {
    id: '7',
    name: 'Almonds',
    calories: 579,
    protein: 21,
    carbs: 22,
    fat: 50,
    fiber: 12,
    sugar: 4.4,
    sodium: 1,
    servingSize: '100g',
    category: 'Nuts'
  },
  {
    id: '8',
    name: 'Spinach',
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    fiber: 2.2,
    sugar: 0.4,
    sodium: 79,
    servingSize: '100g',
    category: 'Vegetables'
  },
  {
    id: '9',
    name: '',
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    fiber: 2.2,
    sugar: 0.4,
    sodium: 79,
    servingSize: '100g',
    category: 'Vegetables'
  }
];

export const SAMPLE_EXERCISES = [
  {
    id: '1',
    name: 'Push-ups',
    category: 'Strength',
    description: 'Upper body strengthening exercise',
    duration: 15,
    caloriesBurned: 50,
    difficulty: 'beginner' as const,
    equipment: [],
    instructions: [
      'Start in plank position',
      'Lower body until chest nearly touches floor',
      'Push back up to starting position',
      'Repeat for desired reps'
    ]
  },
  {
    id: '2',
    name: 'Running',
    category: 'Cardio',
    description: 'Cardiovascular endurance exercise',
    duration: 30,
    caloriesBurned: 300,
    difficulty: 'intermediate' as const,
    equipment: ['Running shoes'],
    instructions: [
      'Start with 5-minute warm-up walk',
      'Maintain steady pace throughout run',
      'Focus on proper breathing',
      'Cool down with 5-minute walk'
    ]
  },
  {
    id: '3',
    name: 'Squats',
    category: 'Strength',
    description: 'Lower body strengthening exercise',
    duration: 20,
    caloriesBurned: 80,
    difficulty: 'beginner' as const,
    equipment: [],
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower body as if sitting back into chair',
      'Keep chest up and knees behind toes',
      'Return to standing position'
    ]
  },
  {
    id: '4',
    name: 'Yoga Flow',
    category: 'Flexibility',
    description: 'Full body stretching and strengthening',
    duration: 45,
    caloriesBurned: 150,
    difficulty: 'intermediate' as const,
    equipment: ['Yoga mat'],
    instructions: [
      'Begin in mountain pose',
      'Flow through sun salutations',
      'Hold poses for 30-60 seconds',
      'End in savasana for relaxation'
    ]
  },
  {
    id: '5',
    name: 'Deadlifts',
    category: 'Strength',
    description: 'Full body compound movement',
    duration: 25,
    caloriesBurned: 120,
    difficulty: 'advanced' as const,
    equipment: ['Barbell', 'Weights'],
    instructions: [
      'Stand with feet hip-width apart',
      'Grip barbell with hands outside legs',
      'Keep back straight, lift by extending hips',
      'Lower bar by pushing hips back'
    ]
  }
];

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', description: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Very Active', description: 'Hard exercise 6-7 days/week' },
  { value: 'very-active', label: 'Extra Active', description: 'Very hard exercise, physical job' }
];

export const DIETARY_RESTRICTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Low-Fat',
  'Diabetic-Friendly',
  'Heart-Healthy'
];

export const COMMON_ALLERGIES = [
  'Nuts',
  'Dairy',
  'Eggs',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
  'Sesame'
];


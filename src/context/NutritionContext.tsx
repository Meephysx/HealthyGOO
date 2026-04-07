import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // Format: YYYY-MM-DD
}

interface NutritionContextType {
  nutrition: NutritionData;
  updateNutrition: (newNutrition: NutritionData) => void;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export const NutritionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [nutrition, setNutrition] = useState<NutritionData>(() => {
    // Initialize state from localStorage if available, for persistence across sessions
    const savedNutrition = localStorage.getItem('todayNutrition');
    if (savedNutrition) {
      try {
        const parsed = JSON.parse(savedNutrition);
        // Basic validation
        if (parsed && typeof parsed.calories === 'number' && parsed.date) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse nutrition data from localStorage", e);
      }
    }
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      date: new Date().toISOString().split('T')[0],
    };
  });

  // Persist nutrition data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('todayNutrition', JSON.stringify(nutrition));
  }, [nutrition]);

  const updateNutrition = useCallback((newNutrition: NutritionData) => {
    // We can add a check to prevent unnecessary re-renders if the data is the same
    setNutrition(prevNutrition => {
      if (
        prevNutrition.calories === newNutrition.calories &&
        prevNutrition.protein === newNutrition.protein &&
        prevNutrition.carbs === newNutrition.carbs &&
        prevNutrition.fat === newNutrition.fat &&
        prevNutrition.date === newNutrition.date
      ) {
        return prevNutrition;
      }
      return newNutrition;
    });
  }, []);

  const value = { nutrition, updateNutrition };

  return (
    <NutritionContext.Provider value={value}>
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (context === undefined) {
    throw new Error('useNutrition must be used within a NutritionProvider');
  }
  return context;
};
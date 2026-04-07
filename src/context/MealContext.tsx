import React, { createContext, useContext, useState } from 'react';

interface MealContextType {
  consumedCalories: number;
  setConsumedCalories: React.Dispatch<React.SetStateAction<number>>;
  totalPlanCalories: number;
  setTotalPlanCalories: React.Dispatch<React.SetStateAction<number>>;
}

const updateConsumedFromCustomMeal = (newConsumedCalories: number) => {
  setConsumed(prev => {
    const updated = prev + newConsumedCalories;
    localStorage.setItem('consumedCalories', JSON.stringify(updated));
    return updated;
  });
};

const MealContext = createContext<MealContextType | undefined>(undefined);

export const MealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [totalPlanCalories, setTotalPlanCalories] = useState(0);

  return (
    <MealContext.Provider
      value={{ consumedCalories, setConsumedCalories, totalPlanCalories, setTotalPlanCalories }}
    >
      {children}
    </MealContext.Provider>
  );
};

export const useMeal = (): MealContextType => {
  const context = useContext(MealContext);
  if (!context) throw new Error('useMeal must be used within a MealProvider');
  return context;
};

function setConsumed(arg0: (prev: any) => any) {
  throw new Error('Function not implemented.');
}

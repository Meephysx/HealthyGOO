import React, { createContext, useState, useContext, ReactNode } from 'react';

// Definisikan tipe untuk konten AI
interface AiContent {
  mealPlan?: any;       // Tipe bisa disesuaikan jika sudah ada
  exercisePlan?: any;   // Tipe bisa disesuaikan jika sudah ada
}

// Definisikan tipe untuk context
interface AiContentContextType {
  aiContent: AiContent;
  setAiContent: React.Dispatch<React.SetStateAction<AiContent>>;
}

// Buat context
export const AiContentContext = createContext<AiContentContextType | undefined>(undefined);

// Buat provider
export const AiContentProvider = ({ children }: { children: ReactNode }) => {
  const [aiContent, setAiContent] = useState<AiContent>({});

  return (
    <AiContentContext.Provider value={{ aiContent, setAiContent }}>
      {children}
    </AiContentContext.Provider>
  );
};

// Buat custom hook untuk kemudahan penggunaan
export const useAiContent = () => {
  const context = useContext(AiContentContext);
  if (context === undefined) {
    throw new Error('useAiContent must be used within an AiContentProvider');
  }
  return context;
};

// src/services/groqService.ts

// This service now acts as a client for our own backend AI endpoint.

type AppMessage = {
  sender: "user" | "ai";
  text: string;
};

type BackendMessage = {
  role: "user" | "assistant";
  content: string;
};

// Structured data types from backend
export interface StructuredMealPlan {
  Sarapan?: {
    menu: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portions?: string;
    time?: string;
  };
  MakanSiang?: {
    menu: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portions?: string;
    time?: string;
  };
  MakanMalam?: {
    menu: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portions?: string;
    time?: string;
  };
  snacks?: {
    menu: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portions?: string;
    time?: string;
  };
  totalCalories?: number;
}

export interface StructuredWorkoutPlan {
  day?: string;
  focus?: string;
  duration?: string;
  intensity?: string;
  exercises?: {
    name: string;
    sets: string;
    caloriesPerSet: number;
  }[];
}

export interface AIResponse {
  reply: string;
  structured_meal_plan?: StructuredMealPlan;
  structured_workout_plan?: StructuredWorkoutPlan;
  offline?: boolean;
  model_used?: string;
  error?: string;
}

/**
 * Sends the chat history to our own backend AI handler.
 * @param messages The history of messages from the chat component.
 * @returns The AI's reply text and structured data.
 */
export const sendMessage = async (
  messages: AppMessage[],
  userProfile: any | null = null
): Promise<AIResponse> => {
  const backendMessages: BackendMessage[] = messages.map((msg) => ({
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.text,
  }));

  try {
    // We assume the endpoint is mounted at /api/ai
    // This is a common convention for backend routes.
    const response = await fetch("/api/ai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: backendMessages, userProfile }),
    });

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData);
      } catch (e) {
        errorDetail = await response.text();
      }
      console.error("Backend API Error:", errorDetail);
      throw new Error(`Backend request failed with status ${response.status}`);
    }

    const text = await response.text();
    console.log("AI Response raw:", text);
    
    let data: AIResponse;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse AI Response JSON:", text);
      throw new Error("Invalid JSON response from server");
    }

    // The backend returns an object with a "reply" field.
    if (!data.reply) {
      console.error("No reply field in data:", data);
      throw new Error("Invalid response format from backend");
    }

    console.log("AI Response parsed:", data);
    return data;
  } catch (error) {
    console.error("sendMessage error:", error);
    return {
      reply: "Sorry, I'm having trouble communicating with the server. Please try again later.",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

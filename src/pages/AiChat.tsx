import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Check, Utensils, Dumbbell } from "lucide-react";
import { auth } from "../firebase";
import {
  getOrCreateChatSession,
  getChatMessages,
  addChatMessage,
  getUserProfile,
} from "../services/firestore";
import { sendMessage, AIResponse, StructuredMealPlan, StructuredWorkoutPlan } from "../services/groqService";
import { DocumentReference } from "firebase/firestore";
import { useDailyLog } from "../context/DailyLogContext";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp?: any;
  mealPlan?: StructuredMealPlan;
  workoutPlan?: StructuredWorkoutPlan;
};

const AiChat = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const { addFoodItem, addExercise } = useDailyLog();

  const [chatSession, setChatSession] = useState<DocumentReference | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to initialize chat session and fetch user profile
  useEffect(() => {
    if (!user) {
      navigate("/onboarding"); // Redirect if not logged in
      return;
    }
    const initChatAndProfile = async () => {
      const sessionRef = await getOrCreateChatSession(user.uid);
      setChatSession(sessionRef);

      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    };
    initChatAndProfile();
  }, [user, navigate]);

  // Effect to subscribe to messages
  useEffect(() => {
    if (!chatSession) return;

    const unsubscribe = getChatMessages(chatSession.id, (newMessages) => {
      setMessages(newMessages);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [chatSession]);

  // Effect to scroll to new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle adding meal to log
  const handleAcceptMeal = async (mealPlan: StructuredMealPlan) => {
    if (!user) return;
    
    try {
      const mealTypes = ['Sarapan', 'MakanSiang', 'MakanMalam', 'snacks'] as const;
      
      for (const type of mealTypes) {
        const meal = mealPlan[type];
        if (meal && meal.menu && meal.menu !== '-') {
          await addFoodItem({
            name: meal.menu,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            servingSize: meal.portions || '1 porsi',
          }, type);
        }
      }
      
      // Show success feedback
      alert("Meal plan berhasil ditambahkan ke log makanan!");
    } catch (error) {
      console.error("Error adding meal plan:", error);
      alert("Gagal menambahkan meal plan. Silakan coba lagi.");
    }
  };

  // Handle adding workout to log
  const handleAcceptWorkout = async (workoutPlan: StructuredWorkoutPlan) => {
    if (!user || !workoutPlan.exercises) return;
    
    try {
      for (const exercise of workoutPlan.exercises) {
        await addExercise({
          name: exercise.name,
          sets: exercise.sets,
          caloriesPerSet: exercise.caloriesPerSet,
        });
      }
      
      // Show success feedback
      alert("Workout plan berhasil ditambahkan ke log latihan!");
    } catch (error) {
      console.error("Error adding workout plan:", error);
      alert("Gagal menambahkan workout plan. Silakan coba lagi.");
    }
  };

  const handleSend = async () => {
    if (input.trim() === "" || !chatSession || !user) return;

    const userMessage = { sender: "user" as const, text: input };
    setInput(""); // Clear input immediately

    // Add user message to Firestore and clear input
    await addChatMessage(chatSession.id, userMessage);
    setIsLoading(true);

    // Create an up-to-date message list for the API
    const messagesForApi = [...messages, userMessage];

    try {
      // Get AI response using the updated message list and user profile
      const aiResponse: AIResponse = await sendMessage(messagesForApi, userProfile);
      
      // Only include fields with defined values to avoid Firestore error
      const aiMessage: any = { 
        sender: "ai" as const, 
        text: aiResponse.reply,
      };
      
      // Only add mealPlan if it has valid content (not empty object)
      if (aiResponse.structured_meal_plan && Object.keys(aiResponse.structured_meal_plan).length > 0) {
        // Check if mealPlan has at least one meal with actual content
        const hasValidMeal = Object.values(aiResponse.structured_meal_plan).some(
          (meal: any) => meal && typeof meal === 'object' && meal.menu && meal.menu !== '-'
        );
        if (hasValidMeal) {
          aiMessage.mealPlan = aiResponse.structured_meal_plan;
        }
      }
      
      // Only add workoutPlan if it has valid content
      if (aiResponse.structured_workout_plan && Object.keys(aiResponse.structured_workout_plan).length > 0) {
        // Check if workoutPlan has exercises
        const hasValidWorkout = aiResponse.structured_workout_plan.exercises && 
          aiResponse.structured_workout_plan.exercises.length > 0;
        if (hasValidWorkout) {
          aiMessage.workoutPlan = aiResponse.structured_workout_plan;
        }
      }

      // Add AI message to Firestore
      await addChatMessage(chatSession.id, aiMessage);
    } catch (error) {
      console.error("Error sending message or getting AI response:", error);
      // Optionally, add an error message to the chat
      await addChatMessage(chatSession.id, {
        sender: "ai",
        text: "Maaf, terjadi kesalahan. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render meal plan card
  const renderMealPlanCard = (mealPlan: StructuredMealPlan) => (
    <div className="mt-4 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="bg-green-500 px-4 py-2 flex items-center">
        <Utensils className="w-5 h-5 text-white mr-2" />
        <span className="text-white font-semibold">Rencana Makan</span>
      </div>
      <div className="p-4 space-y-3">
        {mealPlan.Sarapan && mealPlan.Sarapan.menu !== '-' && (
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <p className="font-medium text-gray-800">🌅 Sarapan</p>
              <p className="text-sm text-gray-600">{mealPlan.Sarapan.menu}</p>
              <p className="text-xs text-gray-500">{mealPlan.Sarapan.calories} kcal</p>
            </div>
          </div>
        )}
        {mealPlan.MakanSiang && mealPlan.MakanSiang.menu !== '-' && (
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <p className="font-medium text-gray-800">🌞 Makan Siang</p>
              <p className="text-sm text-gray-600">{mealPlan.MakanSiang.menu}</p>
              <p className="text-xs text-gray-500">{mealPlan.MakanSiang.calories} kcal</p>
            </div>
          </div>
        )}
        {mealPlan.MakanMalam && mealPlan.MakanMalam.menu !== '-' && (
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <p className="font-medium text-gray-800">🌙 Makan Malam</p>
              <p className="text-sm text-gray-600">{mealPlan.MakanMalam.menu}</p>
              <p className="text-xs text-gray-500">{mealPlan.MakanMalam.calories} kcal</p>
            </div>
          </div>
        )}
        {mealPlan.snacks && mealPlan.snacks.menu !== '-' && (
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-800">🍎 Snack</p>
              <p className="text-sm text-gray-600">{mealPlan.snacks.menu}</p>
              <p className="text-xs text-gray-500">{mealPlan.snacks.calories} kcal</p>
            </div>
          </div>
        )}
        {mealPlan.totalCalories && (
          <div className="mt-3 pt-2 border-t">
            <p className="text-sm font-bold text-green-600">Total: {mealPlan.totalCalories} kcal</p>
          </div>
        )}
        <button
          onClick={() => handleAcceptMeal(mealPlan)}
          className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Check className="w-4 h-4" />
          Tambahkan ke Meal Log
        </button>
      </div>
    </div>
  );

  // Render workout plan card
  const renderWorkoutPlanCard = (workoutPlan: StructuredWorkoutPlan) => (
    <div className="mt-4 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="bg-blue-500 px-4 py-2 flex items-center">
        <Dumbbell className="w-5 h-5 text-white mr-2" />
        <span className="text-white font-semibold">Rencana Latihan</span>
      </div>
      <div className="p-4 space-y-3">
        {workoutPlan.focus && (
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-sm text-gray-600">Fokus: {workoutPlan.focus}</span>
            <span className="text-sm text-gray-600">{workoutPlan.duration}</span>
          </div>
        )}
        {workoutPlan.exercises?.map((exercise, index) => (
          <div key={index} className="flex justify-between items-center border-b pb-2 last:border-0">
            <div>
              <p className="font-medium text-gray-800">{exercise.name}</p>
              <p className="text-xs text-gray-500">{exercise.sets}</p>
            </div>
            <span className="text-xs text-blue-500">~{exercise.caloriesPerSet} kcal/set</span>
          </div>
        ))}
        <button
          onClick={() => handleAcceptWorkout(workoutPlan)}
          className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Check className="w-4 h-4" />
          Tambahkan ke Workout Log
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="mr-4 text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Pelatih AI</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-sm ${
                msg.sender === "user"
                  ? "bg-green-500 text-white rounded-br-lg"
                  : "bg-white text-gray-800 rounded-bl-lg border border-gray-200"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              
              {/* Render meal plan if available */}
              {msg.sender === "ai" && msg.mealPlan && renderMealPlanCard(msg.mealPlan)}
              
              {/* Render workout plan if available */}
              {msg.sender === "ai" && msg.workoutPlan && renderWorkoutPlanCard(msg.workoutPlan)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 rounded-bl-lg rounded-2xl px-4 py-3 flex items-center shadow-sm border border-gray-200">
              <Loader2 className="animate-spin mr-3 text-green-500" size={20} />
              <span>Memproses...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white border-t border-gray-200 p-2 sm:p-4 sticky bottom-0">
        <div className="flex items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
            placeholder="Tanyakan tentang kebugaran atau nutrisi..."
            className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || input.trim() === ""}
            className="ml-3 p-3 rounded-full bg-green-500 text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            aria-label="Kirim pesan"
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AiChat;

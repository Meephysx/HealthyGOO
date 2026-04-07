import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { auth } from "../firebase";
import {
  getOrCreateChatSession,
  getChatMessages,
  addChatMessage,
  getUserProfile,
} from "../services/firestore";
import { sendMessage } from "../services/groqService";
import { DocumentReference } from "firebase/firestore";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp?: any;
};

const AiChat = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

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
      const aiResponseText = await sendMessage(messagesForApi, userProfile);
      const aiMessage = { sender: "ai" as const, text: aiResponseText };

      // Add AI message to Firestore
      await addChatMessage(chatSession.id, aiMessage);
    } catch (error) {
      console.error("Error sending message or getting AI response:", error);
      // Optionally, add an error message to the chat
      await addChatMessage(chatSession.id, {
        sender: "ai",
        text: "Sorry, I encountered an error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="mr-4 text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">AI Coach</h1>
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
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 rounded-bl-lg rounded-2xl px-4 py-3 flex items-center shadow-sm border border-gray-200">
              <Loader2 className="animate-spin mr-3 text-green-500" size={20} />
              <span>Thinking...</span>
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
            placeholder="Ask about fitness or nutrition..."
            className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || input.trim() === ""}
            className="ml-3 p-3 rounded-full bg-green-500 text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AiChat;

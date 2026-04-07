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

/**
 * Sends the chat history to our own backend AI handler.
 * @param messages The history of messages from the chat component.
 * @returns The AI's reply text.
 */
export const sendMessage = async (
  messages: AppMessage[],
  userProfile: any | null = null
): Promise<string> => {
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
      const errorData = await response.json();
      console.error("Backend API Error:", errorData);
      throw new Error(`Backend request failed with status ${response.status}`);
    }

    const data = await response.json();

    // The backend returns an object with a "reply" field.
    if (!data.reply) {
      throw new Error("Invalid response format from backend");
    }

    return data.reply;
  } catch (error) {
    console.error("Failed to send message to backend:", error);
    return "Sorry, I'm having trouble communicating with the server. Please try again later.";
  }
};

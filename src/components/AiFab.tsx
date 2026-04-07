import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const AiFab = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/ai-chat");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-20 right-5 z-40 w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-green-600 text-white shadow-xl transition-transform duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
      aria-label="Open AI Coach"
    >
      <MessageCircle size={28} />
    </button>
  );
};

export default AiFab;

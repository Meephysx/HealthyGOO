import React from 'react';
import { motion } from 'framer-motion';
import { Scan, Sparkles, Play, LucideIcon } from 'lucide-react';

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  gradient: string;
  shadow: string;
  onClick?: () => void;
}

const ActionButton: React.FC<QuickActionProps> = ({ icon: Icon, label, subtitle, gradient, shadow, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.03, y: -2 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`relative flex flex-col items-start p-5 w-full rounded-[24px] bg-gradient-to-br ${gradient} ${shadow} shadow-lg transition-all overflow-hidden group`}
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={80} strokeWidth={1} />
    </div>
    
    <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md mb-4">
      <Icon size={20} className="text-white" />
    </div>
    
    <div className="text-left">
      <h3 className="text-white font-bold text-sm tracking-tight">{label}</h3>
      <p className="text-white/70 text-[10px] font-medium mt-0.5">{subtitle}</p>
    </div>
  </motion.button>
);

const QuickActions: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <ActionButton 
        icon={Scan} 
        label="Pindai Makanan" 
        subtitle="Pindai Nutrisi AI"
        gradient="from-emerald-500 to-teal-600"
        shadow="shadow-emerald-200"
      />
      <ActionButton 
        icon={Sparkles} 
        label="Buat Menu" 
        subtitle="Rencana AI Kustom"
        gradient="from-violet-500 to-purple-600"
        shadow="shadow-purple-200"
      />
      <ActionButton 
        icon={Play} 
        label="Mulai Latihan" 
        subtitle="Rutinitas Aktif"
        gradient="from-blue-500 to-indigo-600"
        shadow="shadow-blue-200"
      />
    </div>
  );
};

export default QuickActions;
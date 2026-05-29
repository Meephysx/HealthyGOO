import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { Flame, Utensils, Zap, Target } from 'lucide-react';

interface CalorieProgressCardProps {
  eaten: number;
  burned: number;
  target: number;
}

const CountUp = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
};

const CalorieProgressCard: React.FC<CalorieProgressCardProps> = ({ eaten, burned, target }) => {
  const size = 180;
  const strokeWidth = 16;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const remaining = Math.max(0, target - eaten + burned);
  const progress = Math.min(1, eaten / target);
  
  // Spring animation for progress ring
  const progressSpring = useSpring(0, { stiffness: 40, damping: 15 });
  
  useEffect(() => {
    progressSpring.set(progress);
  }, [progress, progressSpring]);

  const dashOffset = useTransform(progressSpring, [0, 1], [circumference, 0]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-[32px] p-8 shadow-2xl border border-white/5"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] -mr-20 -mt-20" />
      
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
        
        {/* Circular Progress Ring */}
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90 drop-shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            {/* Background Ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-white/5"
            />
            {/* Progress Ring */}
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="url(#calorieGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              style={{ strokeDashoffset: dashOffset }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white tracking-tighter">
              <CountUp value={remaining} />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Tersisa kcal
            </span>
          </div>
        </div>

        {/* Metrics Breakdown */}
        <div className="flex-1 w-full space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Target size={20} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Energi Harian</h2>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
              On Track
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Eaten Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.08] transition-colors">
              <div className="p-3 bg-orange-500/20 rounded-xl group-hover:scale-110 transition-transform">
                <Utensils size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Terkonsumsi</p>
                <p className="text-xl font-bold text-white"><CountUp value={eaten} /> <span className="text-xs font-medium text-slate-400">kcal</span></p>
              </div>
            </div>

            {/* Burned Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.08] transition-colors">
              <div className="p-3 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform">
                <Flame size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Terbakar</p>
                <p className="text-xl font-bold text-white"><CountUp value={burned} /> <span className="text-xs font-medium text-slate-400">kcal</span></p>
              </div>
            </div>
          </div>

          {/* Progress Info Footer */}
          <div className="pt-4 border-t border-white/5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-medium text-slate-400">Target Achievement</p>
              <p className="text-xs font-bold text-white">{Math.round((eaten / target) * 100)}%</p>
            </div>
            <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (eaten / target) * 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Accent Icons */}
      <div className="absolute -bottom-4 -left-4 opacity-5 pointer-events-none">
        <Zap size={120} className="text-emerald-500" />
      </div>
    </motion.div>
  );
};

export default CalorieProgressCard;
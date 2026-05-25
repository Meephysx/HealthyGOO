import React from 'react';
import { motion } from 'framer-motion';
import { Flame, ChevronRight, Zap, Trophy } from 'lucide-react';

const HeroSection: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative overflow-hidden bg-slate-950 rounded-[28px] p-8 md:p-12 shadow-2xl mb-12"
    >
      {/* Floating Background Shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] animate-pulse" />
      <div className="absolute bottom-[-20%] left-[10%] w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
      
      <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Content */}
        <div className="space-y-6">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full"
            >
              <Flame size={16} className="text-emerald-400 fill-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                7 Day Streak
              </span>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
              Good Morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Aal</span> 👋
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium max-w-md leading-relaxed">
              You're doing great! Ready to crush today's goals and reach new heights?
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-wrap gap-4 pt-4">
            <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20">
              Start Workout <ChevronRight size={20} />
            </button>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-md">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap size={20} className="text-blue-400 fill-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">450 kcal</p>
                <p className="text-slate-500 text-xs">Today's Target</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Content - 3D Mockup Simulation */}
        <motion.div
          variants={itemVariants}
          className="relative hidden lg:flex justify-center items-center"
        >
          <div className="relative w-[320px] h-[320px]">
            {/* Glow effect behind illustration */}
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[40px]" />
            
            {/* Simulated 3D Element */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative z-20 flex items-center justify-center h-full"
            >
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[40px] border border-white/10 shadow-2xl">
                <div className="w-48 h-48 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-[0_20px_50px_rgba(16,185,129,0.3)]">
                  <Trophy size={80} className="text-slate-950" />
                </div>
                <div className="mt-6 space-y-2">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[80%] bg-emerald-400 rounded-full" />
                  </div>
                  <p className="text-center text-xs font-bold text-slate-400 tracking-widest uppercase">Level 12</p>
                </div>
              </div>
            </motion.div>

            {/* Floating Accessory */}
            <motion.div 
              animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute top-0 right-0 bg-blue-500 p-4 rounded-2xl shadow-xl z-30"
            >
              <Zap size={24} className="text-white" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default HeroSection;
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Flame,
  Target, 
  TrendingUp, 
  Activity, 
  Award,
  ChevronRight,
  Apple,
  Dumbbell,
  Heart,
  Zap
} from 'lucide-react';
import HeroSection from './HeroSection';
import CalorieProgressCard from './CalorieProgressCard';
import WeightChart from './WeightChart';
import QuickActions from './QuickActions';
import { getRankFromXP } from '../context/DailyLogContext';
import { getBMICategory, calculateMacroTargets } from '../utils/calculations';
import type { User } from '../types';
import { useDailyLog } from '../context/DailyLogContext';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

interface WeightEntry {
  date: string;
  weight: number;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentDate] = useState(new Date());
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);

  const { consumedCalories, burnedCalories, macros, userProfile, isLoading } = useDailyLog();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const fetchWeightHistory = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const q = query(
        collection(db, 'weight_logs'),
        where('userId', '==', currentUser.uid),
        orderBy('date', 'asc'),
        limit(7)
      );
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({
        date: doc.data().date,
        weight: doc.data().weight
      }));
      setWeightHistory(logs);
    } catch (error) {
      console.error("Error fetching weight history:", error);
    }
  }, []);

  useEffect(() => {
    fetchWeightHistory();
  }, [fetchWeightHistory]);

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const bmiInfo = getBMICategory(user.bmi);
  const macroTargets = calculateMacroTargets(user.dailyCalories, user.goal);
  const caloriesRemaining = user.dailyCalories - consumedCalories + burnedCalories;
  const caloriePercentage = Math.min(100, (consumedCalories / user.dailyCalories) * 100);

  // Rank Logic
  const xp = userProfile?.xp || 0;
  const rank = getRankFromXP(xp);
  const rankThresholds = [
    { name: 'bronze', min: 0, max: 500 },
    { name: 'silver', min: 500, max: 1500 },
    { name: 'gold', min: 1500, max: 3000 },
    { name: 'platinum', min: 3000, max: 6000 },
    { name: 'Shadow Monarch', min: 6000, max: 100000 }
  ];
  const currentThreshold = rankThresholds.find(t => t.name === rank) || rankThresholds[0];
  const xpInLevel = xp - currentThreshold.min;
  const xpNeeded = currentThreshold.max - currentThreshold.min;
  const xpPercentage = Math.min(100, (xpInLevel / xpNeeded) * 100);

  const motivationalQuotes = [
    "Fuel your body, fuel your mind. Keep going! 💪",
    "Every meal is a choice. Choose wisely! 🥗",
    "Progress over perfection. You're doing great! 🌟",
    "Your health is worth the effort. Keep pushing! 🔥",
    "Small steps lead to big results. Keep going! 🚀"
  ];
  
  const getMotivationalQuote = () => {
    const dayOfYear = Math.floor((new Date() as any) / 86400000) % motivationalQuotes.length;
    return motivationalQuotes[dayOfYear];
  };

  const macroItems = [
    { 
      label: 'Protein', 
      current: Math.round(macros.protein), 
      target: Math.round(macroTargets.protein), 
      unit: 'g',
      color: 'from-red-400 to-red-600',
      percentage: Math.min(100, (macros.protein / macroTargets.protein) * 100)
    },
    { 
      label: 'Carbs', 
      current: Math.round(macros.carbs), 
      target: Math.round(macroTargets.carbs), 
      unit: 'g',
      color: 'from-yellow-400 to-yellow-600',
      percentage: Math.min(100, (macros.carbs / macroTargets.carbs) * 100)
    },
    { 
      label: 'Fat', 
      current: Math.round(macros.fat), 
      target: Math.round(macroTargets.fat), 
      unit: 'g',
      color: 'from-orange-400 to-orange-600',
      percentage: Math.min(100, (macros.fat / macroTargets.fat) * 100)
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Modern Premium Hero Section */}
        <HeroSection />

        {/* Rank & XP Progress */}
        <div className="mb-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-100">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 capitalize">{rank} Rank</h3>
                <p className="text-sm text-gray-500 font-medium">{xp} Total XP earned</p>
              </div>
            </div>
            <div className="flex-1 max-w-md w-full">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Next Rank Progress</span>
                <span className="text-xs font-bold text-orange-600">{Math.round(xpPercentage)}%</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 transition-all duration-1000" style={{ width: `${xpPercentage}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Calorie Progress Section */}
        <div className="mb-12">
          <CalorieProgressCard 
            eaten={consumedCalories} 
            burned={burnedCalories} 
            target={user.dailyCalories} 
          />
        </div>

        {/* Premium Weight Trend Chart */}
        <div className="mb-12">
          <WeightChart 
            data={weightHistory} 
            targetWeight={user.idealWeight} 
          />
        </div>

        {/* Macro Targets Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Target className="h-6 w-6 mr-3 text-emerald-600" />
              Macro Targets
            </h2>
            <Link 
              to="/meals" 
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center transition-colors"
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {macroItems.map((macro, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{macro.label}</h3>
                  <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${macro.color} bg-opacity-10`}>
                    <span className={`text-xs font-bold bg-gradient-to-r ${macro.color} bg-clip-text text-transparent`}>
                      {Math.round(macro.percentage)}%
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {macro.current}
                  </p>
                  <p className="text-sm text-gray-500">
                    / {macro.target} {macro.unit}
                  </p>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full bg-gradient-to-r ${macro.color} transition-all duration-500`}
                    style={{ width: `${macro.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Activity className="h-6 w-6 mr-3 text-emerald-600" />
            Your Stats
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Daily Target</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{user.dailyCalories}</p>
                  <p className="text-xs text-gray-500">kcal</p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50">
                  <Flame className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">BMI</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{user.bmi.toFixed(1)}</p>
                  <p className={`text-xs ${bmiInfo.color}`}>{bmiInfo.category}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-50">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Berat Badan</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{user.weight}</p>
                  <p className="text-xs text-gray-500">kg</p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50">
                  <Heart className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Target Berat</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{user.idealWeight}</p>
                  <p className="text-xs text-gray-500">kg</p>
                </div>
                <div className="p-2.5 rounded-lg bg-orange-50">
                  <Award className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Goal Overview */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 mb-4">
                <Zap className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 capitalize mb-3">
                Goal: {user.goal.replace('-', ' ')}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {user.goal === 'weight-loss' && 'Lose weight in a healthy, sustainable way'}
                {user.goal === 'weight-gain' && 'Gain healthy weight with proper nutrition'}
                {user.goal === 'muscle-gain' && 'Build lean muscle mass effectively'}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Current Weight</p>
                  <p className="text-xl font-bold text-gray-900">{user.weight} kg</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border-2 border-emerald-500">
                  <p className="text-xs text-gray-600 mb-1">Target Weight</p>
                  <p className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{user.idealWeight} kg</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Need to</p>
                  <p className="text-xl font-bold text-gray-900">{Math.abs(user.weight - user.idealWeight).toFixed(1)} kg</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link 
            to="/meals" 
            className="group flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Apple className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-center">Track Meals</span>
          </Link>
          <Link 
            to="/exercises" 
            className="group flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Dumbbell className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-center">Workouts</span>
          </Link>
          <Link 
            to="/food-search" 
            className="group flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Flame className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-center">Food Search</span>
          </Link>
          <Link 
            to="/progress" 
            className="group flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <TrendingUp className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-center">Progress</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

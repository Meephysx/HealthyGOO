import React, { useState, useEffect } from 'react';
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
import { getBMICategory, calculateMacroTargets } from '../utils/calculations';
import type { User } from '../types';
import { useDailyLog } from '../context/DailyLogContext';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentDate] = useState(new Date());

  const { consumedCalories, burnedCalories, macros, userProfile, isLoading } = useDailyLog();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

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
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Selamat Datang, {user.name}! 👋
              </h1>
              <p className="text-gray-500 mt-2">
                {currentDate.toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="hidden md:block text-right">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-50 rounded-full">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-emerald-700">On Track</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Daily Summary Card */}
        <div className="mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl p-8 md:p-10 text-white overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500 opacity-5 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500 opacity-5 rounded-full -ml-16 -mb-16"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold flex items-center">
                    <Flame className="h-6 w-6 mr-3 text-orange-400" />
                    Daily Summary
                  </h2>
                  <span className="text-sm font-medium text-emerald-400 bg-emerald-500 bg-opacity-10 px-3 py-1 rounded-full">
                    On Track
                  </span>
                </div>

                {/* Three main metrics */}
                <div className="grid grid-cols-3 gap-6 mb-10">
                  {/* Eaten */}
                  <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium mb-2">EATEN</p>
                    <p className="text-4xl font-bold text-white mb-1">{Math.round(consumedCalories)}</p>
                    <p className="text-slate-400 text-sm">kcal</p>
                    <div className="mt-3 w-full bg-slate-700 rounded-full h-1.5">
                      <div 
                        className="h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                        style={{ width: `${caloriePercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Remaining */}
                  <div className="text-center border-l border-r border-slate-700">
                    <p className="text-slate-400 text-sm font-medium mb-2">REMAINING</p>
                    <p className={`text-4xl font-bold mb-1 ${caloriesRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Math.round(Math.abs(caloriesRemaining))}
                    </p>
                    <p className="text-slate-400 text-sm">kcal</p>
                  </div>

                  {/* Burned */}
                  <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium mb-2">BURNED</p>
                    <p className="text-4xl font-bold text-white mb-1">{Math.round(burnedCalories)}</p>
                    <p className="text-slate-400 text-sm">kcal</p>
                  </div>
                </div>

                {/* Progress bar full width */}
                <div className="mb-8">
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500"
                      style={{ width: `${caloriePercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>0</span>
                    <span>{user.dailyCalories} kcal</span>
                  </div>
                </div>

                {/* Motivational Quote */}
                <div className="pt-6 border-t border-slate-700">
                  <p className="text-slate-300 text-sm italic">
                    "{getMotivationalQuote()}"
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                {user.goal === 'weight-loss' && 'Losowe weight in a healthy, sustainable way'}
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

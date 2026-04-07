import React, { useState, useEffect, useCallback } from "react";
import { Loader, RefreshCw, CheckCircle, Dumbbell, Plus, Trash2, Home, Building2, Zap, Clock, Activity, Info } from "lucide-react";
import { useDailyLog } from '../context/DailyLogContext';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface WorkoutPlan {
  day: string;
  focus: string;
  exercises: Exercise[];
  duration: string;
  intensity: string;
  reasoning: string;
  location: 'home' | 'gym';
  variationSeed?: number;
}

interface Exercise {
  id?: string;
  name: string;
  sets: string;
  caloriesPerSet: number;
}

interface CompletedExercise {
  id?: string;
  name: string;
  sets: string;
  reps: number;
  caloriesBurned: number;
  caloriesPerRep: number;
}

interface User {
  weight: number;
  height: number;
  age: number;
  gender: string;
  goal: string;
  activityLevel: string;
  dailyCalories: number;
}

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================

const EXERCISE_DATABASE: { [key: string]: number } = {
  'push up': 2.5, 'push-up': 2.5, 'squat': 3.5, 'burpee': 4.5, 'plank': 1,
  'pull up': 3.5, 'pull-up': 3.5, 'chin up': 3.5, 'lunges': 3, 'lunge': 3,
  'jumping jack': 2, 'jumping jacks': 2, 'dumbbell': 4, 'bench press': 4,
  'deadlift': 5, 'row': 3.5, 'bicep curl': 2.5, 'tricep dip': 3,
  'mountain climber': 3, 'sit up': 2, 'crunch': 1.5, 'leg raise': 2.5,
};

const DEFAULT_USER: User = {
  weight: 70, height: 170, age: 25, gender: "male",
  goal: "build-muscle", activityLevel: "moderate", dailyCalories: 2500,
};

const FALLBACK_EXERCISES = {
  home: [
    { name: "Push Up", sets: "3x15", caloriesPerSet: 2.5 },
    { name: "Plank", sets: "3x45s", caloriesPerSet: 1 },
    { name: "Squat", sets: "3x20", caloriesPerSet: 3.5 },
    { name: "Lunges", sets: "3x12", caloriesPerSet: 3 },
    { name: "Jumping Jack", sets: "3x30", caloriesPerSet: 2 },
    { name: "Sit Up", sets: "3x15", caloriesPerSet: 2 }
  ],
  gym: [
    { name: "Barbell Bench Press", sets: "3x12", caloriesPerSet: 4 },
    { name: "Deadlift", sets: "3x8", caloriesPerSet: 5 },
    { name: "Dumbbell Row", sets: "3x10", caloriesPerSet: 3.5 },
    { name: "Leg Press", sets: "3x15", caloriesPerSet: 4.5 },
    { name: "Lat Pulldown", sets: "3x12", caloriesPerSet: 3 }
  ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getCaloriesPerRep = (exerciseName: string): number => {
  const lowerName = exerciseName.toLowerCase();
  for (const [key, value] of Object.entries(EXERCISE_DATABASE)) {
    if (lowerName.includes(key)) return value;
  }
  return 3; // Default fallback
};

const parseExerciseSets = (sets: string): { setsNum: number; repsNum: number } => {
  const parts = sets.toLowerCase().split('x');
  const setsNum = parseInt(parts[0]) || 1;
  const repsNum = parseInt(parts[1]) || 1;
  return { setsNum, repsNum };
};

const calculateExerciseCalories = (exercise: Exercise): number => {
  const { setsNum } = parseExerciseSets(exercise.sets);
  return Math.round(exercise.caloriesPerSet * setsNum);
};

const loadUserData = (): User => {
  const stored = localStorage.getItem('user');
  if (!stored) return DEFAULT_USER;
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_USER, ...parsed };
  } catch {
    return DEFAULT_USER;
  }
};

const normalizeExercises = (rawExercises: any, userWeight: number, location: 'home' | 'gym', minCount = 6): Exercise[] => {
  let arr: any[] = Array.isArray(rawExercises) ? rawExercises : (rawExercises ? [rawExercises] : []);
  const normalized = arr.map((ex: any) => {
    const name = (ex.name || ex.exercise || 'Unnamed Exercise').toString();
    const sets = (ex.sets || '3x10').toString();
    const { repsNum } = parseExerciseSets(sets);
    const weightAdjustment = userWeight / 70;
    
    let caloriesPerSet: number;
    const providedCals = Number(ex.caloriesPerSet ?? NaN);

    if (!isNaN(providedCals) && providedCals > 0) {
      caloriesPerSet = Math.round(providedCals * weightAdjustment);
    } else {
      const basePerRep = getCaloriesPerRep(name);
      caloriesPerSet = Math.round(basePerRep * repsNum * weightAdjustment);
    }
    return { name, sets, caloriesPerSet };
  });

  if (normalized.length < minCount) {
    const fallbackList = FALLBACK_EXERCISES[location] || FALLBACK_EXERCISES.home;
    for (const fb of fallbackList) {
      if (normalized.length >= minCount) break;
      const exists = normalized.some(e => e.name.toLowerCase() === fb.name.toLowerCase());
      if (!exists) {
        normalized.push({ ...fb, caloriesPerSet: Math.round(fb.caloriesPerSet * (userWeight / 70)) });
      }
    }
  }

  return normalized;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AIWorkoutPlan: React.FC = () => {
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [completed, setCompleted] = useState<CompletedExercise[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workoutLocation, setWorkoutLocation] = useState<'home' | 'gym'>('home');
  const [exerciseInput, setExerciseInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [user, setUser] = useState<User>(() => loadUserData());

  const { workoutLog, generateAIWorkoutPlan, isGeneratingAI, aiError, addExercise, toggleExerciseCompleted, removeExercise } = useDailyLog();

  useEffect(() => {
    setUser(loadUserData());
    const loadInitialData = async () => {
      setIsGenerating(true);
      // Start with loading state
      setIsGenerating(false);
    };
    loadInitialData();
  }, []);

  // Sync with workoutLog from context
  useEffect(() => {
    if (workoutLog && Array.isArray(workoutLog.exercises) && workoutLog.exercises.length > 0) {
      const exercises = workoutLog.exercises.map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        caloriesPerSet: ex.caloriesPerSet || 10
      }));

      const storedLocation = workoutLog.workoutLocation || workoutLocation;
      setWorkoutLocation(storedLocation);
      
      setWorkoutPlan({
        day: 'Hari Ini',
        focus: workoutLog.workoutType || 'General',
        duration: `${workoutLog.totalDuration || 30} menit`,
        intensity: 'Sedang',
        reasoning: 'Rencana latihan dari AI',
        location: storedLocation,
        exercises: exercises
      });

      // Convert completed exercises from context format
      const completedExercises = workoutLog.exercises
        .filter((ex: any) => ex.completed)
        .map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          sets: ex.sets,
          reps: 1,
          caloriesBurned: ex.caloriesBurned || 0,
          caloriesPerRep: ex.caloriesPerSet || 0
        }));
      
      setCompleted(completedExercises);
      return;
    }
    setWorkoutPlan(null);
    setCompleted([]);
  }, [workoutLog, workoutLocation]);

  useEffect(() => {
    if (!workoutPlan || !Array.isArray(workoutPlan.exercises)) {
      setProgress(0);
      return;
    }
    const total = workoutPlan.exercises.reduce((sum, ex) => sum + calculateExerciseCalories(ex), 0);
    const burned = completed.reduce((sum, ex) => sum + ex.caloriesBurned, 0);
    setProgress(total > 0 ? Math.min(100, Math.round((burned / total) * 100)) : 0);
  }, [completed, workoutPlan]);

  const handleCompleteExercise = async (exercise: Exercise) => {
    if (!exercise.id) {
      console.warn('Exercise missing id; cannot persist completion.');
      return;
    }
    await toggleExerciseCompleted(exercise.id);
  };

  const handleAddExercise = (exerciseName: string, reps: number) => {
    if (!exerciseName.trim() || !reps) return;
    const caloriesPerRep = getCaloriesPerRep(exerciseName);
    const caloriesBurned = Math.round(caloriesPerRep * reps * (user.weight / 70));
    setCompleted([...completed, {
      id: `ex-${Date.now()}`, name: exerciseName, sets: `${reps}x1`, reps, caloriesBurned, caloriesPerRep
    }]);
    setExerciseInput('');
    setRepsInput('');
  };

  const handleRemoveExercise = (index: number) => {
    setCompleted(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocationChange = (newLocation: 'home' | 'gym') => {
    if (newLocation === workoutLocation && workoutPlan) return;
    setWorkoutLocation(newLocation);
    setIsGenerating(true);
    generateAIWorkoutPlan(newLocation).finally(() => setIsGenerating(false));
  };
  
  const burnedCalories = completed.reduce((sum, ex) => sum + ex.caloriesBurned, 0);
  const totalCalories = workoutPlan && Array.isArray(workoutPlan.exercises) ? workoutPlan.exercises.reduce((sum, ex) => sum + calculateExerciseCalories(ex), 0) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-8 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
          <div className="text-center md:text-left"><h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3 justify-center md:justify-start"><span className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200"><Dumbbell className="w-6 h-6" /></span>Workout Plan</h1><p className="text-gray-500 mt-1 text-sm font-medium">Personalized for your goals & body type</p></div>
          <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
            <button onClick={() => handleLocationChange('home')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${workoutLocation === 'home' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><Home className="w-4 h-4 mr-2" />Home</button>
            <button onClick={() => handleLocationChange('gym')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${workoutLocation === 'gym' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><Building2 className="w-4 h-4 mr-2" />Gym</button>
          </div>
          <button onClick={() => generateAIWorkoutPlan(workoutLocation)} disabled={isGenerating} className="flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
            {isGenerating ? <Loader className="w-5 h-5 mr-2 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
            {isGenerating ? "Generating..." : "New Plan"}
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm border border-red-100 flex items-center gap-3"><Info className="w-5 h-5 shrink-0" />{error}</div>}

        {/* --- MAIN CONTENT --- */}
        {isGenerating ? (
            <div className="text-center py-20"><div className="relative w-20 h-20 mx-auto mb-6"><div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div><div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div><Dumbbell className="absolute inset-0 m-auto text-blue-500 w-8 h-8 animate-pulse" /></div><h3 className="text-xl font-bold text-gray-900">Crafting your workout...</h3><p className="text-gray-500 mt-2">Analyzing your profile and goals</p></div>
        ) : workoutPlan ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              {/* Plan Info */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div><h2 className="text-2xl font-bold text-gray-900 tracking-tight">{workoutPlan.focus}</h2><p className="text-gray-500 text-sm font-medium mt-1">{workoutPlan.day}</p></div>
                    <div className="flex gap-2"><span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100"><Clock className="w-3.5 h-3.5" /> {workoutPlan.duration}</span><span className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100"><Activity className="w-3.5 h-3.5" /> {workoutPlan.intensity}</span></div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm text-gray-600 leading-relaxed italic">"{workoutPlan.reasoning}"</div>
                </div>
              </div>
              {/* Exercises */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>Today's Routine</h3>
                <div className="space-y-4">
                  {workoutPlan.exercises && Array.isArray(workoutPlan.exercises) && workoutPlan.exercises.map((ex, idx) => {
                    const isCompleted = ex.id ? completed.some(c => c.id === ex.id) : completed.some(c => c.name === ex.name);
                    return (
                      <div key={idx} className={`group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isCompleted ? 'bg-gray-50 opacity-80' : ''}`}>
                        <div className="flex items-start gap-4"><div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-lg shadow-inner ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{isCompleted ? <CheckCircle className="w-6 h-6" /> : idx + 1}</div>
                          <div><h4 className={`font-bold text-lg leading-tight transition-colors ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-blue-600'}`}>{ex.name}</h4><div className="flex items-center gap-3 mt-2"><span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-md border border-gray-200">{ex.sets}</span><span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Zap className="w-3 h-3" /> ~{calculateExerciseCalories(ex)} kcal</span></div></div>
                        </div>
                        <button onClick={() => !isCompleted && handleCompleteExercise(ex)} disabled={isCompleted} className={`w-full sm:w-auto px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${isCompleted ? 'bg-green-100 text-green-700 cursor-default' : 'bg-gray-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200 active:scale-95'}`}>{isCompleted ? <><CheckCircle className="w-4 h-4" /> Done</> : <><CheckCircle className="w-4 h-4" /> Complete</>}</button>
                      </div>);
                  })}
                </div>
              </div>
              {/* Completed */}
              {completed.length > 0 && <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-green-500 rounded-full"></span>Completed</h3><div className="space-y-3">{completed.map((ex, idx) => (<div key={idx} className="bg-green-50/50 p-4 rounded-2xl border border-green-100 flex items-center justify-between group hover:bg-green-50 transition-colors"><div className="flex items-center gap-4"><div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0"><CheckCircle className="w-5 h-5" /></div><div><p className="font-bold text-gray-800">{ex.name}</p><p className="text-xs text-green-700 font-medium mt-0.5">{ex.reps} reps • {ex.caloriesBurned} kcal burned</p></div></div><button onClick={() => handleRemoveExercise(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button></div>))}</div></div>}
            </div>
            <div className="lg:col-span-4 sticky top-6 space-y-6">
              {/* Calories Widget */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />Calories Burned</h3>
                <div className="flex flex-col items-center justify-center mb-8 relative"><div className="relative h-40 w-40"><svg className="h-full w-full -rotate-90" viewBox="0 0 36 36"><path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" /><path className={`${progress === 100 ? "text-green-500" : "text-blue-500"} transition-all duration-1000 ease-out`} strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold text-gray-900">{burnedCalories}</span><span className="text-xs text-gray-400 font-medium uppercase tracking-wide">kcal</span></div></div></div>
                <div className="space-y-4"><div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="text-sm text-gray-500 font-medium">Goal</span><span className="text-sm font-bold text-gray-900">{totalCalories} kcal</span></div><div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="text-sm text-gray-500 font-medium">Remaining</span><span className="text-sm font-bold text-gray-900">{Math.max(0, totalCalories - burnedCalories)} kcal</span></div></div>
              </div>
              {/* Quick Add */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Add</h3>
                <div className="space-y-4">
                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Exercise Name</label><input type="text" placeholder="e.g. Push Up" value={exerciseInput} onChange={(e) => setExerciseInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"/></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Total Reps</label><input type="number" placeholder="e.g. 20" value={repsInput} onChange={(e) => setRepsInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"/></div>
                  {exerciseInput && repsInput && (<div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center"><span className="text-xs text-blue-600 font-medium">Est. Burn:</span><span className="text-sm font-bold text-blue-700">{Math.round(getCaloriesPerRep(exerciseInput) * parseInt(repsInput) * (user.weight / 70))}{" "}kcal</span></div>)}
                  <button onClick={() => handleAddExercise(exerciseInput, parseInt(repsInput) || 0)} disabled={!exerciseInput.trim() || !repsInput} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Log</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-md px-4 mx-auto py-20">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500"><Dumbbell className="w-10 h-10" /></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Sweat?</h3>
            <p className="text-gray-500 mb-8">Select your preferred location and let AI generate a personalized workout plan.</p>
            <button onClick={() => generateAIWorkoutPlan(workoutLocation)} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 transition-all">Generate First Plan</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIWorkoutPlan;

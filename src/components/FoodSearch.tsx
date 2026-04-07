import React, { useState } from 'react';
import { Search, Loader, Check, AlertCircle, ArrowRight, Plus, X, Coffee, Sun, Moon, Cookie } from 'lucide-react';
import { saveUserLog, fetchUserLogByDate, getDateKey } from '../services/logger';

export interface FoodDetail {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
}

interface FoodSearchProps {
  onSelectFood?: (food: FoodDetail) => void;
}

const AISearch: React.FC<FoodSearchProps> = ({ onSelectFood }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedFood, setAddedFood] = useState<string | null>(null);
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [tempSelectedFood, setTempSelectedFood] = useState<FoodDetail | null>(null);

  const handleSearch = async () => {
    if (searchQuery.trim() === '') return;

    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    const prompt = `
      Sebagai ahli nutrisi, berikan informasi nutrisi lengkap untuk makanan: '${searchQuery}'.
      
      Instruksi Output:
      1. Berikan output HANYA dalam format JSON Array.
      2. Jangan gunakan markdown block.
      3. Gunakan Bahasa Indonesia.
      
      Struktur JSON Wajib:
      [
        {
          "name": "Nama Makanan",
          "calories": 0,
          "protein": 0,
          "carbs": 0,
          "fat": 0,
          "servingSize": "ukuran porsi"
        }
      ]
    `;

    try {
      const { callAi, parseJsonLike } = await import('../utils/aiClient');
      // Use Groq model name to route to Groq backend
      const data = await callAi([{ role: 'user', content: prompt }], 'llama3-8b-8192');

      if (data.offline) {
        // If backend provided structured offline nutrition estimates, use them
        if (Array.isArray((data as any).offline_nutrition) && (data as any).offline_nutrition.length > 0) {
          const foods = (data as any).offline_nutrition.map((it: any) => ({
            name: it.name || 'Unknown',
            calories: Number(it.calories || 0),
            protein: Number(it.protein || 0),
            carbs: Number(it.carbs || it.carbohydrates || 0),
            fat: Number(it.fat || 0),
            servingSize: it.servingSize || it.serving || ''
          }));
          setSearchResults(foods);
          return;
        }

        setError("AI Offline: " + (data.reply || 'Coba lagi nanti.'));
        return;
      }

      const rawContent = data.reply ?? "";
      let normalized = rawContent;
      if (typeof rawContent !== 'string') normalized = JSON.stringify(rawContent);

      // Defensive parsing pipeline using parseJsonLike and progressive sanitization
      let parsed: any = parseJsonLike(normalized);
      if (!parsed) {
        // Strip code fences and trim
        let cleanedText = String(normalized).replace(/```json/g, '').replace(/```/g, '').trim();
        // If single object, wrap into array for consistency
        if (cleanedText.startsWith('{')) cleanedText = `[${cleanedText}]`;
        const start = cleanedText.indexOf('[');
        const end = cleanedText.lastIndexOf(']');
        if (start !== -1 && end !== -1) cleanedText = cleanedText.substring(start, end + 1);

        // First attempt: parse using helper
        parsed = parseJsonLike(cleanedText);

        // Fallback attempts: try replacing single quotes with double quotes
        if (!parsed) {
          try {
            const doubleQuoted = cleanedText.replace(/'/g, '"');
            parsed = parseJsonLike(doubleQuoted);
          } catch (e) {
            // ignore
          }
        }

        // Fallback: quote unquoted keys (simple heuristic)
        if (!parsed) {
          try {
            const keyed = cleanedText.replace(/([{,]\s*)([A-Za-z0-9_\-]+)\s*:/g, '$1"$2":');
            parsed = parseJsonLike(keyed);
          } catch (e) {
            // ignore
          }
        }

        // If still not parsed, include small snippet for error reporting
        if (!parsed) {
          console.error('[FoodSearch] Failed to parse AI response as JSON array', { rawContent, cleanedText: String(normalized).slice(0, 800) });
          throw new Error('Unable to parse AI response as JSON array. Raw snippet: ' + String(normalized).slice(0, 800));
        }
      }

      // If parsed is a single object, wrap in array
      let foodsData: any[] = [];
      if (Array.isArray(parsed)) foodsData = parsed;
      else if (typeof parsed === 'object' && parsed !== null) foodsData = [parsed];
      else throw new Error('Parsed AI response is not an object or array.');

      // Validate items
      const foods: FoodDetail[] = foodsData.map((it: any) => ({
        name: it.name || it.nama || 'Unknown',
        calories: Number(it.calories || it.kcal || 0),
        protein: Number(it.protein || 0),
        carbs: Number(it.carbs || it.carbohydrates || 0),
        fat: Number(it.fat || 0),
        servingSize: it.servingSize || it.serving || it.porsi || ''
      }));

      setSearchResults(foods);

    } catch (err: any) {
      console.error('[FoodSearch] search error', err);
      setError("Gagal mencari makanan. " + (err && err.message ? err.message : 'Coba lagi nanti.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = (food: FoodDetail) => {
    if (onSelectFood) {
      onSelectFood(food);
      setAddedFood(food.name);
      setTimeout(() => setAddedFood(null), 1500); 
    } else {
      // Standalone mode: Show modal to select meal type
      setTempSelectedFood(food);
      setShowMealTypeModal(true);
    }
  };

  const confirmAddToMeal = async (mealType: 'Sarapan' | 'MakanSiang' | 'MakanMalam' | 'snacks') => {
    if (!tempSelectedFood) return;

    try {
      const dateKey = getDateKey();
      
      // 1. Fetch existing log to append (Prevent overwrite)
      const existingLog: any = await fetchUserLogByDate('meal', dateKey);
      const currentFoods = Array.isArray(existingLog?.foods) ? existingLog.foods : [];

      // 2. Prepare new food item
      const newFood = {
        id: `f-${Date.now()}`,
        name: tempSelectedFood.name,
        calories: tempSelectedFood.calories,
        protein: tempSelectedFood.protein,
        carbs: tempSelectedFood.carbs,
        fat: tempSelectedFood.fat,
        portions: tempSelectedFood.servingSize,
        mealType: mealType,
        source: 'manual',
        consumed: false // Default to planned
      };

      // 3. Save to Firestore using Global Helper
      const updatedFoods = [...currentFoods, newFood];
      await saveUserLog('meal', { foods: updatedFoods }, dateKey);


      setAddedFood(tempSelectedFood.name);
      setTimeout(() => setAddedFood(null), 1500);
      setShowMealTypeModal(false);
      setTempSelectedFood(null);
    } catch (e) {
      console.error("Gagal menyimpan ke meal plan:", e);
      setError("Gagal menyimpan data.");
    }
  };

  return (
    <div className="w-full">
      {/* --- HEADER COMPACT --- */}
      <div className="mb-5 text-center">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
          Powered by AI Search
        </p>

        {/* --- SEARCH BAR BARU (Compact & Modern) --- */}
        <div className="relative w-full max-w-md mx-auto group">
          {/* Ikon Kiri */}
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-green-500 transition-colors" />
          </div>

          {/* Input Field */}
          <input
            type="text"
            className="block w-full pl-10 pr-12 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:bg-white focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all shadow-sm outline-none placeholder:text-gray-400"
            placeholder="Cari makanan (misal: Nasi Padang)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />

          {/* Tombol Kanan (Inside Input) */}
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-sm transform active:scale-95"
            >
              {isLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- ERROR STATE --- */}
      {error && (
        <div className="flex items-center justify-center gap-2 text-red-500 text-xs bg-red-50 p-2 rounded-lg mb-4 mx-auto max-w-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* --- RESULTS LIST --- */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {!isLoading && searchResults.length > 0 ? (
          searchResults.map((food, index) => (
            <div
              key={index}
              className="group border border-gray-100 bg-white rounded-xl p-3 flex justify-between items-center hover:border-green-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex-grow min-w-0 mr-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-bold text-gray-800 truncate">{food.name}</h3>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap">
                    {food.calories} kcal
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">{food.servingSize}</p>
                
                {/* Makro Mini */}
                <div className="flex gap-2 text-[10px] text-gray-500 font-medium">
                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">P: {food.protein}g</span>
                  <span className="bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">K: {food.carbs}g</span>
                  <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded">L: {food.fat}g</span>
                </div>
              </div>
              
              <button
                onClick={() => handleAddClick(food)}
                className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                  addedFood === food.name 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                }`}
              >
                {addedFood === food.name ? <Check size={16} /> : <Plus size={18} />}
              </button>
            </div>
          ))
        ) : (
          /* Empty State yang lebih bersih */
          !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <Search className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs">Hasil pencarian akan muncul di sini</p>
            </div>
          )
        )}
      </div>

      {/* --- MODAL PILIH WAKTU MAKAN (Standalone Mode) --- */}
      {showMealTypeModal && tempSelectedFood && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Tambahkan ke...</h3>
              <button onClick={() => setShowMealTypeModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
               <div className="bg-white p-2 rounded-full shadow-sm">
                  <Check size={16} className="text-green-600" />
               </div>
               <div>
                  <p className="text-xs text-gray-500">Item dipilih:</p>
                  <p className="font-bold text-gray-800 text-sm line-clamp-1">{tempSelectedFood.name}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => confirmAddToMeal('Sarapan')} className="flex flex-col items-center justify-center p-3 border rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-all gap-2">
                <Coffee size={24} className="text-orange-500" />
                <span className="text-xs font-medium text-gray-700">Sarapan</span>
              </button>
              <button onClick={() => confirmAddToMeal('MakanSiang')} className="flex flex-col items-center justify-center p-3 border rounded-xl hover:bg-yellow-50 hover:border-yellow-200 transition-all gap-2">
                <Sun size={24} className="text-yellow-500" />
                <span className="text-xs font-medium text-gray-700">Makan Siang</span>
              </button>
              <button onClick={() => confirmAddToMeal('MakanMalam')} className="flex flex-col items-center justify-center p-3 border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all gap-2">
                <Moon size={24} className="text-blue-500" />
                <span className="text-xs font-medium text-gray-700">Makan Malam</span>
              </button>
              <button onClick={() => confirmAddToMeal('snacks')} className="flex flex-col items-center justify-center p-3 border rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all gap-2">
                <Cookie size={24} className="text-purple-500" />
                <span className="text-xs font-medium text-gray-700">Snack</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISearch;
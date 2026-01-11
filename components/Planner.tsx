import React, { useState } from 'react';
import { DAYS_OF_WEEK, WeeklyPlan, Protein, Recipe, DayPlan, Supermarket } from '../types';
import { fetchWeeklyPlan } from '../services/geminiService';
import { Calendar, RefreshCw, ShoppingCart, Loader2, Utensils, Moon, Check, Clock, ChefHat, MapPin, ChevronDown } from 'lucide-react';
import RecipeCard from './RecipeCard';

interface PlannerProps {
  plan: WeeklyPlan | null;
  setPlan: (plan: WeeklyPlan) => void;
  onAddToShoppingList: (recipe: Recipe) => void;
  isRecipeInList: (title: string) => boolean;
  onUpdateRecipeImage: (id: string, img: string) => void;
  isFavorite: (recipe: Recipe) => boolean;
  onToggleFavorite: (recipe: Recipe) => void;
  onCacheRecipes: (recipes: Recipe[]) => void;
}

const Planner: React.FC<PlannerProps> = ({ 
    plan, 
    setPlan, 
    onAddToShoppingList, 
    isRecipeInList,
    onUpdateRecipeImage,
    isFavorite, 
    onToggleFavorite,
    onCacheRecipes
}) => {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Protein[]>([Protein.ANY]);
  const [maxTime, setMaxTime] = useState(45);
  const [difficulty, setDifficulty] = useState('Any');
  const [supermarket, setSupermarket] = useState<Supermarket>('Any');

  const handleGenerate = async () => {
    setLoading(true);
    const newPlan = await fetchWeeklyPlan(preferences, maxTime, difficulty, supermarket);
    if (newPlan) {
        setPlan(newPlan);
        
        // Extract and cache all recipes from the plan so they are saved to history
        const allRecipes: Recipe[] = [];
        (Object.values(newPlan) as DayPlan[]).forEach(day => {
            if (day.lunch) allRecipes.push(day.lunch);
            if (day.dinner) allRecipes.push(day.dinner);
        });
        
        if (allRecipes.length > 0) {
            onCacheRecipes(allRecipes);
        }
    }
    setLoading(false);
  };

  const toggleProtein = (p: Protein) => {
    if (p === Protein.ANY) {
        // If selecting Any, clear others
        setPreferences([Protein.ANY]);
        return;
    }

    let newPrefs = [...preferences];
    
    // If Any was selected, remove it when selecting specific proteins
    if (newPrefs.includes(Protein.ANY)) {
        newPrefs = [];
    }

    if (newPrefs.includes(p)) {
        newPrefs = newPrefs.filter(x => x !== p);
    } else {
        newPrefs.push(p);
    }

    // If nothing selected, default back to Any
    if (newPrefs.length === 0) {
        newPrefs = [Protein.ANY];
    }

    setPreferences(newPrefs);
  };

  const addAllToShoppingList = () => {
    if (!plan) return;
    let count = 0;
    (Object.values(plan) as DayPlan[]).forEach(day => {
        if (day.lunch && !isRecipeInList(day.lunch.title)) {
            onAddToShoppingList(day.lunch);
            count++;
        }
        if (day.dinner && !isRecipeInList(day.dinner.title)) {
            onAddToShoppingList(day.dinner);
            count++;
        }
    });
    if (count === 0) alert("All items are already in your list!");
    else alert(`Added ${count} recipes to your shopping list.`);
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      
      {/* Header / Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-primary" />
                Weekly Meal Planner
            </h2>
            <p className="text-gray-500 text-sm mt-1">Automatically plan your lunch and dinner for the week.</p>
        </div>

        <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 bg-primary hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap self-end md:self-auto"
            >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {plan ? 'Regenerate Plan' : 'Generate Plan'}
        </button>
      </div>

      {/* Preferences Grid */}
      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Time Preference */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Max Prep Time
            </label>
            <div className="relative">
                <select
                    value={maxTime}
                    onChange={(e) => setMaxTime(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 border p-2.5 pr-10 text-sm focus:ring-primary focus:border-primary outline-none bg-gray-100 text-gray-900 appearance-none"
                >
                    <option value={15}>15 mins (Very Quick)</option>
                    <option value={30}>30 mins (Quick)</option>
                    <option value={45}>45 mins (Average)</option>
                    <option value={60}>60 mins (Relaxed)</option>
                    <option value={120}>No Limit</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
        </div>

        {/* Competency / Difficulty */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <ChefHat className="w-4 h-4" /> Difficulty
            </label>
            <div className="relative">
                <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 pr-10 text-sm focus:ring-primary focus:border-primary outline-none bg-gray-100 text-gray-900 appearance-none"
                >
                    <option value="Any">Any Level</option>
                    <option value="Easy">Easy (Beginner)</option>
                    <option value="Medium">Medium (Home Cook)</option>
                    <option value="Hard">Hard (Experienced)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
        </div>

        {/* Supermarket */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Supermarket
            </label>
            <div className="relative">
                <select
                    value={supermarket}
                    onChange={(e) => setSupermarket(e.target.value as Supermarket)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 pr-10 text-sm focus:ring-primary focus:border-primary outline-none bg-gray-100 text-gray-900 appearance-none"
                >
                    <option value="Any">Any (Best Price)</option>
                    <option value="Aldi">Aldi</option>
                    <option value="Coles">Coles</option>
                    <option value="Woolworths">Woolworths</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
        </div>

        {/* Protein Selection */}
        <div className="lg:col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Proteins</label>
            <div className="flex flex-wrap gap-2">
                {Object.values(Protein).map((p) => {
                    const isSelected = preferences.includes(p);
                    return (
                        <button
                            key={p}
                            onClick={() => toggleProtein(p)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                                isSelected 
                                ? 'bg-primary/10 border-primary text-primary' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                        >
                            {isSelected && <Check className="w-3 h-3" />}
                            {p}
                        </button>
                    );
                })}
            </div>
        </div>
      </div>

      {!plan && !loading && (
          <div className="text-center py-12 bg-white rounded-xl">
             <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
             <h3 className="text-lg font-medium text-gray-600">Ready to plan?</h3>
             <p className="text-gray-400 mb-6 text-sm">Adjust your preferences above and click generate.</p>
          </div>
      )}

      {loading && (
          <div className="text-center py-20">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Curating your weekly menu...</p>
              <p className="text-gray-400 text-sm">This may take a few seconds.</p>
          </div>
      )}

      {plan && !loading && (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Action Bar */}
            <div className="flex justify-end">
                 <button
                    onClick={addAllToShoppingList}
                    className="flex items-center gap-2 text-sm text-secondary font-semibold hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors"
                 >
                    <ShoppingCart className="w-4 h-4" />
                    Add Week to Shopping List
                 </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-8">
                {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 flex justify-between items-center border-b border-gray-200">
                            <span>{day}</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50">
                            
                            {/* Lunch */}
                            <div className="flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-orange-600 uppercase tracking-wider">
                                    <Utensils className="w-4 h-4" /> Lunch
                                </div>
                                {plan[day].lunch ? (
                                    <div className="flex-1">
                                        <RecipeCard 
                                            recipe={plan[day].lunch!}
                                            isFavorite={isFavorite(plan[day].lunch!)}
                                            onToggleFavorite={() => onToggleFavorite(plan[day].lunch!)}
                                            onAddToShoppingList={onAddToShoppingList}
                                            isInShoppingList={isRecipeInList(plan[day].lunch!.title)}
                                            onImageGenerated={onUpdateRecipeImage}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                                        No lunch planned
                                    </div>
                                )}
                            </div>

                            {/* Dinner */}
                            <div className="flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-indigo-600 uppercase tracking-wider">
                                    <Moon className="w-4 h-4" /> Dinner
                                </div>
                                {plan[day].dinner ? (
                                    <div className="flex-1">
                                        <RecipeCard 
                                            recipe={plan[day].dinner!}
                                            isFavorite={isFavorite(plan[day].dinner!)}
                                            onToggleFavorite={() => onToggleFavorite(plan[day].dinner!)}
                                            onAddToShoppingList={onAddToShoppingList}
                                            isInShoppingList={isRecipeInList(plan[day].dinner!.title)}
                                            onImageGenerated={onUpdateRecipeImage}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                                        No dinner planned
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default Planner;
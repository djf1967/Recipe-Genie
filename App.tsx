import React, { useState, useEffect, useCallback } from 'react';
import { Recipe, FilterState, MealType, Protein, ShoppingListItem, WeeklyPlan, IngredientContribution, cleanIngredientText } from './types';
import { fetchRecipes } from './services/geminiService';
import Filters from './components/Filters';
import RecipeCard from './components/RecipeCard';
import ShoppingList from './components/ShoppingList';
import Planner from './components/Planner';
import { ChefHat, ShoppingBag, Heart, Menu, X, Calendar, Compass, Sparkles, Clock, ArrowUp } from 'lucide-react';

// Improved storage handler that attempts to save images but falls back if quota is exceeded
const saveWithQuotaCheck = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
        // Check for quota exceeded error (names vary by browser)
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
             console.warn(`Storage quota exceeded for ${key}. Saving without images.`);
             // Create a version without images
             const cleanData = JSON.stringify(data, (k, v) => {
                 if (k === 'image') return undefined;
                 return v;
             });
             try {
                localStorage.setItem(key, cleanData);
             } catch (e2) {
                 console.error("Failed to save data even without images", e2);
             }
        } else {
            console.error("LocalStorage error", e);
        }
    }
};

const STORAGE_KEYS = {
    LIST: 'chefgenie_list_v4',
    FAV: 'chefgenie_fav_recipes_v3',
    PLAN: 'chefgenie_plan_v3',
    CACHE: 'chefgenie_recipe_cache_v1' // New cache key
};

const App: React.FC = () => {
  // State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  // Global cache of all recipes ever seen
  const [recipeCache, setRecipeCache] = useState<Recipe[]>([]);
  
  const [filters, setFilters] = useState<FilterState>({
    mealType: MealType.DINNER,
    protein: [Protein.ANY],
    maxTime: 30,
    supermarket: 'Any',
    difficulty: 'Any',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [view, setView] = useState<'discover' | 'favorites' | 'planner' | 'list'>('discover');
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    const savedList = localStorage.getItem(STORAGE_KEYS.LIST);
    if (savedList) setShoppingList(JSON.parse(savedList));
    
    const savedFavRecipes = localStorage.getItem(STORAGE_KEYS.FAV);
    if (savedFavRecipes) setFavoriteRecipes(JSON.parse(savedFavRecipes));

    const savedPlan = localStorage.getItem(STORAGE_KEYS.PLAN);
    if (savedPlan) setWeeklyPlan(JSON.parse(savedPlan));

    const savedCache = localStorage.getItem(STORAGE_KEYS.CACHE);
    if (savedCache) setRecipeCache(JSON.parse(savedCache));
  }, []);

  // Persist data when changed
  useEffect(() => {
    saveWithQuotaCheck(STORAGE_KEYS.LIST, shoppingList);
  }, [shoppingList]);

  useEffect(() => {
    saveWithQuotaCheck(STORAGE_KEYS.FAV, favoriteRecipes);
  }, [favoriteRecipes]);

  useEffect(() => {
    if (weeklyPlan) saveWithQuotaCheck(STORAGE_KEYS.PLAN, weeklyPlan);
  }, [weeklyPlan]);

  // Save cache whenever it updates (includes images)
  useEffect(() => {
      saveWithQuotaCheck(STORAGE_KEYS.CACHE, recipeCache);
  }, [recipeCache]);


  const getCachedMatches = (currentFilters: FilterState) => {
    return recipeCache.filter(r => {
        // 1. Meal Type
        if (r.mealType !== currentFilters.mealType) return false;
        
        // 2. Protein
        // Matches if "Any" is selected OR if the recipe's protein is in the selected list
        const proteinMatch = currentFilters.protein.includes(Protein.ANY) || currentFilters.protein.includes(r.protein);
        if (!proteinMatch) return false;

        // 3. Time
        if (r.prepTimeMinutes > currentFilters.maxTime) return false;

        // 4. Difficulty
        if (currentFilters.difficulty !== 'Any') {
             // Map string filter to numeric range for cache check
             const level = r.difficulty;
             if (currentFilters.difficulty === 'Easy' && level > 2) return false;
             if (currentFilters.difficulty === 'Medium' && (level < 3 || level > 3)) return false; // Strict medium = 3
             if (currentFilters.difficulty === 'Hard' && level < 4) return false;
        }

        return true;
    });
  };

  const addToCache = useCallback((newRecipes: Recipe[]) => {
      setRecipeCache(prev => {
          // Deduplicate by title to avoid growing indefinitely with copies
          const existingTitles = new Set(prev.map(r => r.title));
          const uniqueNew = newRecipes.filter(r => !existingTitles.has(r.title));
          if (uniqueNew.length === 0) return prev;
          return [...prev, ...uniqueNew];
      });
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setView('discover');
    setRecipes([]);

    // 1. Check Cache First
    const matches = getCachedMatches(filters);

    // If we have a decent number of matches in cache, show them instead of fetching
    if (matches.length >= 9) {
        // Shuffle the cached results so we don't always see the exact same list in same order
        const shuffled = [...matches].sort(() => 0.5 - Math.random());
        setRecipes(shuffled.slice(0, 9)); // Show batch of 9
        setIsLoading(false);
        return;
    }

    // 2. If not enough cache matches, call API
    try {
        const [batch1, batch2, batch3] = await Promise.all([
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3),
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3),
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3)
        ]);
        
        const combined = [...batch1, ...batch2, ...batch3];
        const unique = Array.from(new Map(combined.map(item => [item.title, item])).values());
        
        setRecipes(unique);
        addToCache(unique); // Save to cache for next time
    } catch (e) {
        console.error("Failed to fetch recipes", e);
    } finally {
        setIsLoading(false);
    }
  };

  const loadMore = async () => {
      setIsLoadingMore(true);

      // 1. Check if there are more hidden cached matches
      const matches = getCachedMatches(filters);
      const currentTitles = new Set(recipes.map(r => r.title));
      const availableInCache = matches.filter(r => !currentTitles.has(r.title));

      if (availableInCache.length >= 9) {
          const shuffled = availableInCache.sort(() => 0.5 - Math.random());
          setRecipes(prev => [...prev, ...shuffled.slice(0, 9)]);
          setIsLoadingMore(false);
          return;
      }

      // 2. Fetch new if cache exhausted
      try {
        // Fetch 9 recipes in parallel batches of 3 for speed and variety
        const [batch1, batch2, batch3] = await Promise.all([
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3),
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3),
            fetchRecipes(filters.mealType, filters.protein, filters.maxTime, filters.supermarket, filters.difficulty, 3)
        ]);
        
        const moreRecipes = [...batch1, ...batch2, ...batch3];
        
        setRecipes(prev => {
             const existingTitles = new Set(prev.map(r => r.title));
             const newUnique = moreRecipes.filter(r => !existingTitles.has(r.title));
             return [...prev, ...newUnique];
        });
        addToCache(moreRecipes);

      } catch (e) {
        console.error("Failed to load more", e);
      } finally {
        setIsLoadingMore(false);
      }
  }

  // --- Image Handling ---
  const handleUpdateRecipeImage = (id: string, img: string) => {
    // Update displayed recipes
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, image: img } : r));
    
    // Update Favorites
    setFavoriteRecipes(prev => prev.map(r => r.id === id ? { ...r, image: img } : r));

    // Update Cache (CRITICAL for "close to zero" API calls next time)
    setRecipeCache(prev => prev.map(r => r.id === id ? { ...r, image: img } : r));

    // Update Plan
    if (weeklyPlan) {
        const newPlan = { ...weeklyPlan };
        let planChanged = false;
        Object.keys(newPlan).forEach((dayKey) => {
            const day = dayKey as keyof WeeklyPlan;
            if (newPlan[day].lunch && newPlan[day].lunch?.id === id) {
                newPlan[day].lunch!.image = img;
                planChanged = true;
            }
            if (newPlan[day].dinner && newPlan[day].dinner?.id === id) {
                newPlan[day].dinner!.image = img;
                planChanged = true;
            }
        });
        if (planChanged) setWeeklyPlan(newPlan);
    }
  };


  // --- Favorites ---
  const handleToggleFavorite = (recipe: Recipe) => {
      const exists = favoriteRecipes.find(r => r.title === recipe.title); 
      if (exists) {
          setFavoriteRecipes(prev => prev.filter(r => r.title !== recipe.title));
      } else {
          setFavoriteRecipes(prev => [...prev, recipe]);
      }
  };

  const isFav = (recipe: Recipe) => !!favoriteRecipes.find(r => r.title === recipe.title);

  // --- Shopping List Logic ---
  
  // Check if a recipe contributes to the list
  const isRecipeInList = (title: string) => {
    return shoppingList.some(item => 
        item.contributions.some(c => c.recipeTitle === title)
    );
  };

  const toggleShoppingList = (recipe: Recipe) => {
    if (isRecipeInList(recipe.title)) {
        // REMOVE LOGIC: Filter out contributions from this recipe
        setShoppingList(prev => {
            return prev.map(item => ({
                ...item,
                contributions: item.contributions.filter(c => c.recipeTitle !== recipe.title)
            })).filter(item => item.contributions.length > 0); // Remove items with no contributions
        });
    } else {
        // ADD LOGIC: Merge ingredients
        setShoppingList(prev => {
            const newList = [...prev];

            recipe.ingredients.forEach(ing => {
                const normName = cleanIngredientText(ing.item);
                const store = ing.store || 'Any';

                // Try to find an existing item to merge into
                const existingItemIndex = newList.findIndex(
                    item => item.store === store && item.name === normName
                );

                const contribution: IngredientContribution = {
                    recipeId: recipe.id,
                    recipeTitle: recipe.title,
                    text: ing.item,
                    price: ing.price
                };

                if (existingItemIndex >= 0) {
                    // Update existing item
                    newList[existingItemIndex] = {
                        ...newList[existingItemIndex],
                        checked: false, // Uncheck if adding more to it
                        contributions: [...newList[existingItemIndex].contributions, contribution]
                    };
                } else {
                    // Create new item
                    newList.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: normName,
                        store: store,
                        checked: false,
                        contributions: [contribution]
                    });
                }
            });

            return newList;
        });
    }
  };

  const removeFromShoppingList = (id: string) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
  };

  const toggleShoppingItem = (id: string) => {
    setShoppingList(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const clearShoppingList = () => setShoppingList([]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-8 flex flex-col md:flex-row items-center justify-between z-10 shrink-0 gap-4 md:gap-0">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="bg-primary p-2 rounded-lg text-white">
                    <ChefHat className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">ChefGenie</h1>
                    <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Meal Planner</p>
                </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-2 w-full md:w-auto">
                <button 
                    onClick={() => setView('discover')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'discover' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Compass className="w-4 h-4" />
                    Discover
                </button>
                <button 
                    onClick={() => setView('planner')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'planner' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Calendar className="w-4 h-4" />
                    Planner
                </button>
                <button 
                    onClick={() => setView('favorites')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'favorites' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Heart className={`w-4 h-4 ${view === 'favorites' ? 'fill-current' : ''}`} />
                    Favorites <span className="text-xs bg-gray-200 px-1.5 rounded-full text-gray-700">{favoriteRecipes.length}</span>
                </button>
            </nav>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
            
            {view === 'list' ? (
                // On mobile, the list takes over the main view
                <div className="h-full">
                     <ShoppingList 
                        items={shoppingList}
                        onRemoveItem={removeFromShoppingList}
                        onToggleItem={toggleShoppingItem}
                        onClearList={clearShoppingList}
                        className="h-full w-full"
                    />
                </div>
            ) : (
                <div className="p-4 md:p-8 max-w-6xl mx-auto pb-4">
                    {view === 'discover' && (
                        <>
                            <Filters 
                                filters={filters} 
                                setFilters={setFilters} 
                                onSearch={handleSearch}
                                isLoading={isLoading}
                            />
                            
                            {recipes.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {recipes.map((recipe) => (
                                            <RecipeCard 
                                                key={recipe.id}
                                                recipe={recipe}
                                                isFavorite={isFav(recipe)}
                                                onToggleFavorite={() => handleToggleFavorite(recipe)}
                                                onAddToShoppingList={toggleShoppingList}
                                                isInShoppingList={isRecipeInList(recipe.title)}
                                                onImageGenerated={handleUpdateRecipeImage}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-12 text-center pb-10">
                                        <button 
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium py-3 px-8 rounded-full shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                                        >
                                            {isLoadingMore && <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>}
                                            {isLoadingMore ? 'Loading...' : 'Load More Recipes'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                                    {isLoading ? (
                                        <div className="py-20 text-center">
                                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
                                            <h2 className="text-xl font-semibold text-gray-800">Firing up the stove...</h2>
                                            <p className="text-gray-500 mt-2">Our AI chef is curating recipes just for you.</p>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-4xl mx-auto mt-2">
                                            <div className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-xl min-h-[400px] flex flex-col justify-center items-center text-center p-8 group">
                                                {/* Background Image with Overlay */}
                                                <div className="absolute inset-0">
                                                    <img 
                                                        src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2400&auto=format&fit=crop" 
                                                        alt="Cooking background" 
                                                        className="w-full h-full object-cover opacity-40 transition-transform duration-1000 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-gray-900/30" />
                                                </div>

                                                {/* Content */}
                                                <div className="relative space-y-6 max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-700">
                                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-white/20 shadow-lg mb-4">
                                                        <ChefHat className="w-10 h-10 text-primary" />
                                                    </div>
                                                    
                                                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                                                        Your Personal AI Chef
                                                    </h2>
                                                    
                                                    <p className="text-lg text-gray-200 leading-relaxed">
                                                        Tell us what you're craving, and we'll craft the perfect menu. 
                                                        <br className="hidden md:block"/>
                                                        From quick dinners to weekly meal plans.
                                                    </p>

                                                    {/* Feature Pills */}
                                                    <div className="flex flex-wrap justify-center gap-3 pt-4">
                                                        <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4 text-yellow-400" />
                                                            AI Powered
                                                        </span>
                                                        <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-blue-400" />
                                                            Quick Recipes
                                                        </span>
                                                        <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                                                            <ShoppingBag className="w-4 h-4 text-green-400" />
                                                            Smart List
                                                        </span>
                                                    </div>

                                                    <div className="pt-8 animate-bounce">
                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">
                                                            Set filters above to start
                                                        </p>
                                                        <ArrowUp className="w-6 h-6 text-primary mx-auto" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {view === 'planner' && (
                        <Planner 
                            plan={weeklyPlan} 
                            setPlan={setWeeklyPlan}
                            onAddToShoppingList={toggleShoppingList}
                            isRecipeInList={isRecipeInList}
                            onUpdateRecipeImage={handleUpdateRecipeImage}
                            isFavorite={isFav}
                            onToggleFavorite={handleToggleFavorite}
                            onCacheRecipes={addToCache}
                        />
                    )}

                    {view === 'favorites' && (
                        <>
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Favorites</h2>
                            {favoriteRecipes.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                                    <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                                    <h2 className="text-xl font-semibold text-gray-700">No favorites yet</h2>
                                    <p className="text-gray-500">Star recipes you love to save them here.</p>
                                    <button 
                                        onClick={() => setView('discover')}
                                        className="mt-6 text-primary font-medium hover:underline"
                                    >
                                        Browse Recipes
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {favoriteRecipes.map((recipe) => (
                                        <RecipeCard 
                                            key={recipe.id}
                                            recipe={recipe}
                                            isFavorite={true}
                                            onToggleFavorite={() => handleToggleFavorite(recipe)}
                                            onAddToShoppingList={toggleShoppingList}
                                            isInShoppingList={isRecipeInList(recipe.title)}
                                            onImageGenerated={handleUpdateRecipeImage}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </main>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden bg-white border-t border-gray-200 flex justify-around items-center p-2 pb-safe z-30 shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
             <button 
                onClick={() => setView('discover')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 transition-all ${view === 'discover' ? 'text-primary bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <Compass className={`w-6 h-6 ${view === 'discover' ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold">Discover</span>
            </button>
            <button 
                onClick={() => setView('planner')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 transition-all ${view === 'planner' ? 'text-primary bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <Calendar className={`w-6 h-6 ${view === 'planner' ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold">Planner</span>
            </button>
            <button 
                onClick={() => setView('favorites')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 transition-all ${view === 'favorites' ? 'text-primary bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <Heart className={`w-6 h-6 ${view === 'favorites' ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold">Favorites</span>
            </button>
            <button 
                onClick={() => setView('list')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 transition-all ${view === 'list' ? 'text-primary bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <div className="relative">
                    <ShoppingBag className={`w-6 h-6 ${view === 'list' ? 'fill-current' : ''}`} />
                    {shoppingList.filter(i => !i.checked).length > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full border-2 border-white">
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold">List</span>
            </button>
        </div>

      </div>

      {/* Shopping List Sidebar (Desktop Only) */}
      <div 
        className={`hidden md:block shrink-0 bg-white border-l border-gray-200 transition-all duration-500 ease-in-out overflow-hidden ${
            shoppingList.length > 0 && view !== 'list' 
            ? 'w-80 opacity-100' 
            : 'w-0 opacity-0 border-l-0'
        }`}
      >
          <div className="w-80 h-full">
            <ShoppingList 
                items={shoppingList}
                onRemoveItem={removeFromShoppingList}
                onToggleItem={toggleShoppingItem}
                onClearList={clearShoppingList}
            />
          </div>
      </div>

    </div>
  );
};

export default App;
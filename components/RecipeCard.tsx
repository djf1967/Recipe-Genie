import React, { useState, useEffect, useRef } from 'react';
import { Recipe, cleanIngredientText } from '../types';
import { Star, Clock, ChefHat, Heart, Plus, Check, Loader2, Trash2, ExternalLink, DollarSign } from 'lucide-react';
import { generateRecipeImage } from '../services/geminiService';

interface RecipeCardProps {
  recipe: Recipe;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onAddToShoppingList: (recipe: Recipe) => void;
  isInShoppingList: boolean;
  onImageGenerated?: (id: string, imageData: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ 
  recipe, 
  isFavorite, 
  onToggleFavorite,
  onAddToShoppingList,
  isInShoppingList,
  onImageGenerated
}) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Use a ref to prevent double-firing in strict mode or rapid updates
  const generationStarted = useRef(false);

  useEffect(() => {
    // If we have no image and haven't started generating, let's generate
    if (!recipe.image && !generationStarted.current && onImageGenerated) {
        generationStarted.current = true;
        setImageLoading(true);
        generateRecipeImage(recipe.title).then((img) => {
            if (img) {
                onImageGenerated(recipe.id, img);
            }
            setImageLoading(false);
        }).catch(() => setImageLoading(false));
    }
  }, [recipe.id, recipe.image, recipe.title, onImageGenerated]);

  // Logic to determine if we show the hero image section
  const showHeroImage = !!recipe.image || imageLoading;

  const getStoreBadgeColor = (store: string) => {
    const s = store.toLowerCase();
    if (s.includes('aldi')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('woolworths') || s.includes('woolies')) return 'bg-green-100 text-green-800 border-green-200';
    if (s.includes('coles')) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getProductSearchUrl = (query: string, store: string) => {
    // Clean query to remove quantities (e.g. "200g") for better search results
    const cleanedQuery = cleanIngredientText(query);
    const q = encodeURIComponent(cleanedQuery);
    const s = store.toLowerCase();
    
    if (s.includes('woolworths')) return `https://www.woolworths.com.au/shop/search/products?searchTerm=${q}`;
    if (s.includes('coles')) return `https://www.coles.com.au/search?q=${q}`;
    if (s.includes('aldi')) return `https://www.google.com/search?q=aldi+australia+${q}`;
    
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      {showHeroImage && (
        <div className="relative h-48 overflow-hidden bg-gray-100 group">
            {recipe.image ? (
                <img 
                src={recipe.image} 
                alt={recipe.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
                        <span className="text-xs font-medium text-gray-500">Preparing photo...</span>
                    </div>
                </div>
            )}
            
            <button
            onClick={() => onToggleFavorite(recipe.id)}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-colors z-10"
            >
            <Heart 
                className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
            />
            </button>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium flex items-center gap-1 z-10">
            <Clock className="w-3 h-3" />
            {recipe.prepTimeMinutes} min
            </div>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{recipe.title}</h3>
          {!showHeroImage && (
             <button
                onClick={() => onToggleFavorite(recipe.id)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors shrink-0"
            >
                <Heart 
                    className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
                />
            </button>
          )}
        </div>
        
        {!showHeroImage && (
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                 <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recipe.prepTimeMinutes} min
                </div>
            </div>
        )}

        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">{recipe.description}</p>

        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
           <div className="flex items-center gap-1">
             <ChefHat className="w-4 h-4 text-orange-500" />
             <span className="font-medium">{recipe.difficulty}/5</span>
           </div>
           <div className="flex items-center">
             {[...Array(5)].map((_, i) => (
               <Star 
                 key={i} 
                 className={`w-3 h-3 ${i < recipe.difficulty ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
               />
             ))}
           </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-auto">
          {showInstructions ? (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Ingredients</h4>
              <ul className="text-sm text-gray-600 list-disc list-inside mb-3 space-y-1">
                {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                  <li key={idx} className="line-clamp-1 flex items-center flex-wrap gap-1.5">
                      <a 
                        href={getProductSearchUrl(ing.item, ing.store)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline decoration-1 underline-offset-2 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        title={`Search for ${ing.item}`}
                      >
                        {ing.item}
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                      
                      {ing.price && (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                            {ing.price}
                          </span>
                      )}

                      {ing.store && ing.store !== 'Any' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStoreBadgeColor(ing.store)} font-medium whitespace-nowrap cursor-default`}>
                              {ing.store}
                          </span>
                      )}
                  </li>
                ))}
                {recipe.ingredients.length > 5 && <li className="text-xs italic">+{recipe.ingredients.length - 5} more</li>}
              </ul>
              
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Instructions</h4>
               <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                {recipe.instructions.map((step, idx) => (
                  <li key={idx} className="mb-1">{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="flex gap-2">
             <button 
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex-1 text-center py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
             >
               {showInstructions ? 'Hide Details' : 'View Details'}
             </button>
             <button 
              onClick={() => onAddToShoppingList(recipe)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                isInShoppingList 
                  ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg'
              }`}
             >
               {isInShoppingList ? (
                 <div className="group relative w-full h-full flex items-center justify-center">
                     <span className="group-hover:hidden flex items-center gap-2"><Check className="w-4 h-4" /> Added</span>
                     <span className="hidden group-hover:flex items-center gap-2"><Trash2 className="w-4 h-4" /> Remove</span>
                 </div>
               ) : (
                 <><Plus className="w-4 h-4" /> List</>
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
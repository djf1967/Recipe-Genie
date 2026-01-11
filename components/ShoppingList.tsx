import React, { useState } from 'react';
import { ShoppingListItem, cleanIngredientText, Supermarket } from '../types';
import { Trash2, ShoppingCart, Share2, MapPin, ExternalLink, DollarSign, Store } from 'lucide-react';

interface ShoppingListProps {
  items: ShoppingListItem[];
  onRemoveItem: (id: string) => void;
  onToggleItem: (id: string) => void;
  onClearList: () => void;
  className?: string;
}

const ShoppingList: React.FC<ShoppingListProps> = ({ items, onRemoveItem, onToggleItem, onClearList, className = '' }) => {
  const [shopAt, setShopAt] = useState<Supermarket>('Any');

  // Group items by store for better organization
  const groupedItems = items.reduce((acc, item) => {
    let storeKey = 'Other';
    
    // If a specific store mode is active, group everything under that store
    if (shopAt !== 'Any') {
        storeKey = shopAt;
    } else {
        // Default grouping based on ingredient source
        let store = item.store || 'Other';
        if (store.toLowerCase().includes('aldi')) storeKey = 'Aldi';
        else if (store.toLowerCase().includes('coles')) storeKey = 'Coles';
        else if (store.toLowerCase().includes('woolworths')) storeKey = 'Woolworths';
        else storeKey = 'Other';
    }

    if (!acc[storeKey]) {
      acc[storeKey] = [];
    }
    acc[storeKey].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  const totalItems = items.length;
  const checkedItems = items.filter(i => i.checked).length;
  const progress = totalItems === 0 ? 0 : (checkedItems / totalItems) * 100;
  
  // Calculate estimated total price
  const calculateTotal = () => {
      let total = 0;
      items.forEach(item => {
          item.contributions.forEach(c => {
              if (c.price) {
                  // Attempt to parse price string e.g., "$3.50", "3.50", "approx $3"
                  const match = c.price.match(/(\d+(\.\d+)?)/);
                  if (match) {
                      total += parseFloat(match[0]);
                  }
              }
          });
      });
      return total;
  };

  const estimatedTotal = calculateTotal();

  const getStoreStyle = (store: string) => {
      const s = store.toLowerCase();
      if (s.includes('aldi')) return 'bg-blue-600 text-white border-blue-700';
      if (s.includes('woolworths')) return 'bg-green-600 text-white border-green-700';
      if (s.includes('coles')) return 'bg-red-600 text-white border-red-700';
      return 'bg-gray-700 text-white border-gray-800';
  };

  const getProductSearchUrl = (query: string, originalStore: string) => {
    const cleanedQuery = cleanIngredientText(query);
    const q = encodeURIComponent(cleanedQuery);
    
    // If shopAt is set, use that. Otherwise use the item's original store.
    const targetStore = (shopAt !== 'Any' ? shopAt : originalStore).toLowerCase();
    
    if (targetStore.includes('woolworths')) return `https://www.woolworths.com.au/shop/search/products?searchTerm=${q}`;
    if (targetStore.includes('coles')) return `https://www.coles.com.au/search?q=${q}`;
    if (targetStore.includes('aldi')) return `https://www.google.com/search?q=aldi+australia+${q}`;
    
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  };

  // Helper to construct display text from multiple contributions
  const getItemDisplay = (item: ShoppingListItem) => {
      const texts = Array.from(new Set(item.contributions.map(c => c.text)));
      if (texts.length === 1) return texts[0];
      return texts.join(' + ');
  };

  const getItemPriceDisplay = (item: ShoppingListItem) => {
      const prices = item.contributions
        .map(c => c.price)
        .filter(p => p) as string[];
      
      if (prices.length === 0) return null;
      if (prices.length === 1) return prices[0];

      let sum = 0;
      let allParseable = true;
      for (const p of prices) {
          const match = p.match(/(\d+(\.\d+)?)/);
          if (match) {
              sum += parseFloat(match[0]);
          } else {
              allParseable = false;
          }
      }
      if (allParseable && sum > 0) return `$${sum.toFixed(2)}`;
      return prices.join(' + ');
  }

  const getItemRecipes = (item: ShoppingListItem) => {
      const recipes = Array.from(new Set(item.contributions.map(c => c.recipeTitle)));
      if (recipes.length === 0) return '';
      if (recipes.length === 1) return `from ${recipes[0]}`;
      return `from ${recipes[0]} + ${recipes.length - 1} others`;
  };

  const storeOrder = ['Aldi', 'Woolworths', 'Coles'];
  const sortedStoreKeys = Object.keys(groupedItems).sort((a, b) => {
      const idxA = storeOrder.indexOf(a);
      const idxB = storeOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
  });

  return (
    <div className={`flex flex-col bg-white h-full ${className}`}>
      <div className="p-5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Shopping List
          </h2>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
            {checkedItems}/{totalItems}
          </span>
        </div>

        {/* Store Selector */}
        <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Store className="w-3 h-3" /> Shop At
            </label>
            <div className="relative">
                <select 
                    value={shopAt} 
                    onChange={(e) => setShopAt(e.target.value as Supermarket)}
                    className="w-full text-sm bg-white border border-gray-200 rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
                >
                    <option value="Any">Mixed / Best Price</option>
                    <option value="Aldi">Aldi</option>
                    <option value="Coles">Coles</option>
                    <option value="Woolworths">Woolworths</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            {shopAt !== 'Any' && (
                <p className="text-[10px] text-gray-400 mt-1">
                    Showing all items for {shopAt}. Prices may vary.
                </p>
            )}
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>

        {estimatedTotal > 0 && shopAt === 'Any' && (
            <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">Est. Total</span>
                <span className="text-lg font-bold text-emerald-700">${estimatedTotal.toFixed(2)}</span>
            </div>
        )}

        <div className="flex gap-2">
            <button 
                onClick={onClearList}
                className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium py-1 px-2 border border-red-200 rounded hover:bg-red-50 transition-colors"
            >
                Clear All
            </button>
            <button 
                onClick={() => alert("Shopping list copied to clipboard!")}
                className="flex-1 text-xs text-gray-600 hover:text-gray-800 font-medium py-1 px-2 border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
            >
                <Share2 className="w-3 h-3" /> Share
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {totalItems === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Your list is empty.</p>
            <p className="text-sm">Add recipes to generate a list.</p>
          </div>
        ) : (
          sortedStoreKeys.map((store) => (
            <div key={store} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className={`px-3 py-2 text-sm font-bold flex items-center justify-between ${getStoreStyle(store)}`}>
                  <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 opacity-80" />
                      {store}
                  </div>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                      {groupedItems[store].length} items
                  </span>
              </div>
              <ul className="divide-y divide-gray-50">
                {groupedItems[store].map(item => {
                  const priceDisplay = getItemPriceDisplay(item);
                  return (
                    <li key={item.id} className="group flex flex-col p-2 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onToggleItem(item.id)}>
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                            {item.checked && <CheckIcon className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <span className={`text-sm block leading-tight ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {getItemDisplay(item)}
                                    </span>
                                    {priceDisplay && shopAt === 'Any' && (
                                        <span className={`text-xs font-semibold whitespace-nowrap shrink-0 ${item.checked ? 'text-gray-300' : 'text-emerald-600'}`}>
                                            {priceDisplay}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-0.5 block truncate">
                                    {getItemRecipes(item)}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <a 
                                    href={getProductSearchUrl(item.name, item.store)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-300 hover:text-primary transition-colors p-1"
                                    title={`Search at ${shopAt !== 'Any' ? shopAt : item.store}`}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Remove item"
                                >
                                <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default ShoppingList;
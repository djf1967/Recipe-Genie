import React from 'react';
import { FilterState, MealType, Protein, Supermarket } from '../types';
import { Filter, Clock, Utensils, Check, MapPin, ChefHat, ChevronDown } from 'lucide-react';

interface FiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onSearch: () => void;
  isLoading: boolean;
}

const Filters: React.FC<FiltersProps> = ({ filters, setFilters, onSearch, isLoading }) => {
  const handleChange = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleProtein = (p: Protein) => {
    let newProteins = [...filters.protein];
    
    if (p === Protein.ANY) {
        newProteins = [Protein.ANY];
    } else {
        // Remove ANY if it exists when selecting a specific protein
        if (newProteins.includes(Protein.ANY)) {
            newProteins = [];
        }

        if (newProteins.includes(p)) {
            newProteins = newProteins.filter(i => i !== p);
        } else {
            newProteins.push(p);
        }

        // If nothing selected, default back to Any
        if (newProteins.length === 0) {
            newProteins = [Protein.ANY];
        }
    }
    handleChange('protein', newProteins);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <div className="flex flex-col md:flex-row gap-6 items-end">
        
        {/* Meal Type */}
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Utensils className="w-4 h-4" /> Meal Type
          </label>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {Object.values(MealType).map((type) => (
              <button
                key={type}
                onClick={() => handleChange('mealType', type)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  filters.mealType === type
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Protein */}
        <div className="flex-[1.5] w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Main Ingredients</label>
           <div className="flex flex-wrap gap-2">
            {Object.values(Protein).map((p) => {
              const isSelected = filters.protein.includes(p);
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

      <div className="flex flex-col md:flex-row gap-6 items-end mt-4">
        {/* Supermarket */}
        <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Supermarket
            </label>
            <div className="relative">
                <select
                    value={filters.supermarket}
                    onChange={(e) => handleChange('supermarket', e.target.value)}
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

        {/* Difficulty */}
        <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <ChefHat className="w-4 h-4" /> Difficulty
            </label>
            <div className="relative">
                <select
                    value={filters.difficulty}
                    onChange={(e) => handleChange('difficulty', e.target.value)}
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

        {/* Time */}
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Max Time
          </label>
          <div className="relative">
            <select
                value={filters.maxTime}
                onChange={(e) => handleChange('maxTime', Number(e.target.value))}
                className="w-full rounded-lg border-gray-300 border p-2.5 pr-10 text-sm focus:ring-primary focus:border-primary outline-none bg-gray-100 text-gray-900 appearance-none"
            >
                <option value={15}>Under 15 mins</option>
                <option value={30}>Under 30 mins</option>
                <option value={45}>Under 45 mins</option>
                <option value={60}>Under 60 mins</option>
                <option value={120}>No Limit</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Action */}
        <div className="w-full md:w-auto">
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="w-full md:w-auto bg-primary hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Finding...
              </>
            ) : (
              <>
                <Filter className="w-4 h-4" />
                Find Recipes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Filters;
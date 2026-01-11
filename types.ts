export enum MealType {
  LUNCH = 'Lunch',
  DINNER = 'Dinner',
}

export enum Protein {
  ANY = 'Any',
  CHICKEN = 'Chicken',
  BEEF = 'Beef',
  PORK = 'Pork',
  LAMB = 'Lamb',
  FISH = 'Fish',
  VEGETARIAN = 'Vegetarian',
}

export type Supermarket = 'Any' | 'Aldi' | 'Coles' | 'Woolworths';

export interface Ingredient {
  item: string;
  store: string; // e.g., 'Aldi', 'Woolworths', 'Any'
  price: string; // e.g., '$3.50'
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  mealType: MealType;
  protein: Protein;
  prepTimeMinutes: number;
  difficulty: number; // 1-5
  ingredients: Ingredient[];
  instructions: string[];
  image?: string; // Base64 image string
}

export interface FilterState {
  mealType: MealType;
  protein: Protein[];
  maxTime: number; // minutes
  supermarket: Supermarket;
  difficulty: string;
}

export interface IngredientContribution {
    recipeId: string;
    recipeTitle: string;
    text: string;
    price?: string;
}

export type ShoppingListItem = {
  id: string;
  name: string; // Normalized name for matching (e.g., "chicken breast")
  store: string;
  checked: boolean;
  contributions: IngredientContribution[];
};

export type DayPlan = {
  lunch: Recipe | null;
  dinner: Recipe | null;
};

export type WeeklyPlan = {
  [key in 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday']: DayPlan;
};

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

// Helper to clean ingredient text for search and grouping
export const cleanIngredientText = (text: string): string => {
    let cleaned = text.toLowerCase();
    // remove text in parens
    cleaned = cleaned.replace(/\([^)]*\)/g, '');
    // remove special chars except spaces
    cleaned = cleaned.replace(/[^a-z0-9\s]/g, '');
    
    // Remove common quantity/unit patterns
    // e.g. "500g", "1/2 cup", "2 tbsp", "1 can of"
    const quantityRegex = /^([\d\.\/\s]+)?(g|kg|ml|l|oz|lb|cups?|tsp|tbsp|pinch|bunch|pieces?|slices?|cans?|tins?|bottles?|packets?|jars?|cloves?|heads?|stalks?|fillets?)?\s+(of\s+)?/;
    cleaned = cleaned.replace(quantityRegex, '').trim();

    // Remove remaining leading numbers if any
    cleaned = cleaned.replace(/^[\d\s\.\/]+/, '').trim();
    
    // Simple singularization (remove trailing 's' unless 'ss')
    if (cleaned.length > 3 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
        cleaned = cleaned.slice(0, -1);
    }
    
    return cleaned;
};
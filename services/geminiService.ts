import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MealType, Protein, Recipe, WeeklyPlan, DAYS_OF_WEEK, Supermarket } from "../types";

// Helper to generate a consistent fake ID since the AI won't generate stable unique IDs across calls easily
const generateId = () => Math.random().toString(36).substr(2, 9);

const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key not found");
      return null;
    }
    return new GoogleGenAI({ apiKey });
};

// --- Image Generation Queue ---
// Prevents hitting API rate limits (429) by processing image requests with a staggered start.
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  // Reduced delay to 300ms for faster start of parallel requests
  private minDelay = 300; 

  add(task: () => Promise<void>) {
    this.queue.push(task);
    this.process();
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      
      // Enforce delay between STARTING requests
      if (timeSinceLast < this.minDelay) {
        await new Promise(r => setTimeout(r, this.minDelay - timeSinceLast));
      }

      const task = this.queue.shift();
      if (task) {
        // execute task without awaiting completion to allow parallelism
        task().catch(e => console.error("Queue task failed", e));
      }
      this.lastRequestTime = Date.now();
    }
    this.processing = false;
  }
}

const imageQueue = new RequestQueue();

export const generateRecipeImage = async (title: string): Promise<string | undefined> => {
  return new Promise((resolve) => {
      imageQueue.add(async () => {
          try {
            const ai = getAI();
            if (!ai) {
                resolve(undefined);
                return;
            }

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [
                  {
                    text: `Delicious food photo of ${title}, professional, 4k.`,
                  },
                ],
              },
              config: {
                // No responseMimeType for image generation models
              }
            });

            // Extract image
            let found = false;
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                resolve(`data:image/png;base64,${part.inlineData.data}`);
                found = true;
                break;
              }
            }
            if (!found) resolve(undefined);

          } catch (error) {
            console.error("Error generating image:", error);
            // If error is 429, we might want to back off, but for now just fail gracefully
            resolve(undefined);
          }
      });
  });
};

export const fetchRecipes = async (
  mealType: MealType,
  proteins: Protein[],
  maxTime: number,
  supermarket: Supermarket,
  difficulty: string,
  count: number = 6
): Promise<Recipe[]> => {
  try {
    const ai = getAI();
    if (!ai) return [];

    const proteinPrompt = (proteins.includes(Protein.ANY) || proteins.length === 0)
        ? "various proteins" 
        : proteins.join(" or ");

    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          mealType: { type: Type.STRING, enum: ["Lunch", "Dinner"] },
          protein: { type: Type.STRING },
          prepTimeMinutes: { type: Type.INTEGER },
          difficulty: { type: Type.INTEGER, description: "Rating from 1 to 5" },
          ingredients: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    store: { type: Type.STRING, description: "The supermarket name." },
                    price: { type: Type.STRING, description: "Estimated price in AUD (e.g. '$2.50')." }
                },
                required: ["item", "store", "price"]
            } 
          },
          instructions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
        },
        required: ["title", "description", "mealType", "prepTimeMinutes", "difficulty", "ingredients", "instructions"],
      },
    };

    const lifestyleContext = mealType === MealType.LUNCH
        ? "Work-friendly lunches."
        : "Easy dinners.";

    let storePrompt = "";
    if (supermarket === 'Any') {
        storePrompt = `Ingredients from Aldi, Coles, or Woolworths (choose lowest price).`;
    } else {
        storePrompt = `Ingredients from ${supermarket} with estimated price.`;
    }

    let difficultyPrompt = "1-5";
    if (difficulty === 'Easy') difficultyPrompt = "1 or 2 (Easy)";
    else if (difficulty === 'Medium') difficultyPrompt = "3 (Medium)";
    else if (difficulty === 'Hard') difficultyPrompt = "4 or 5 (Hard)";

    // Simplified prompt to reduce token count and latency
    const prompt = `
      Generate ${count} distinct ${mealType} recipes with ${proteinPrompt}, max ${maxTime} mins.
      
      CONTEXT: Melbourne, Australia. 
      ${storePrompt}
      ${lifestyleContext}

      Difficulty: ${difficultyPrompt}.
      Instructions: Concise steps.
      Return valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7, 
      },
    });

    const data = JSON.parse(response.text || "[]");

    // Map to our internal type and add IDs
    return data.map((item: any) => ({
      ...item,
      id: generateId(),
      // Ensure specific enum mapping if the AI is loose with capitalization
      mealType: item.mealType === 'Dinner' ? MealType.DINNER : MealType.LUNCH,
      protein: item.protein as Protein, 
    }));

  } catch (error) {
    console.error("Error fetching recipes from Gemini:", error);
    return [];
  }
};

export const fetchWeeklyPlan = async (
    proteinPreferences: Protein[],
    maxTime: number,
    difficulty: string,
    supermarket: Supermarket
): Promise<WeeklyPlan | null> => {
    try {
        const ai = getAI();
        if (!ai) return null;

        const recipeSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              mealType: { type: Type.STRING },
              protein: { type: Type.STRING },
              prepTimeMinutes: { type: Type.INTEGER },
              difficulty: { type: Type.INTEGER },
              ingredients: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT,
                    properties: {
                        item: { type: Type.STRING },
                        store: { type: Type.STRING },
                        price: { type: Type.STRING }
                    },
                    required: ["item", "store", "price"]
                } 
              },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title", "description", "mealType", "prepTimeMinutes", "difficulty", "ingredients", "instructions"]
        };

        const daySchema: Schema = {
            type: Type.OBJECT,
            properties: {
                lunch: recipeSchema,
                dinner: recipeSchema
            },
            required: ["lunch", "dinner"]
        };

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                Monday: daySchema,
                Tuesday: daySchema,
                Wednesday: daySchema,
                Thursday: daySchema,
                Friday: daySchema,
                Saturday: daySchema,
                Sunday: daySchema,
            },
            required: DAYS_OF_WEEK as unknown as string[]
        };

        const proteinString = proteinPreferences.length > 0 ? proteinPreferences.join(', ') : 'Any';
        
        let storePrompt = "";
        if (supermarket === 'Any') {
            storePrompt = `Ingredients from Aldi, Coles, or Woolworths.`;
        } else {
            storePrompt = `Ingredients from ${supermarket}.`;
        }

        const prompt = `
            Create a weekly meal plan (Mon-Sun), 1 Lunch + 1 Dinner per day.
            
            Context: Melbourne, Australia. 
            ${storePrompt}
            Prices in AUD.

            Constraints:
            - Max time: ${maxTime} mins.
            - Difficulty: ${difficulty}.
            - Proteins: ${proteinString}.
            
            Lunch: Portable. Dinner: Main.
            Instructions: Concise steps.
            Return valid JSON.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.7,
            },
        });

        const data = JSON.parse(response.text || "{}");

        // Process IDs
        const processed: any = {};
        for (const day of DAYS_OF_WEEK) {
            if (data[day]) {
                processed[day] = {
                    lunch: data[day].lunch ? { ...data[day].lunch, id: generateId(), mealType: MealType.LUNCH } : null,
                    dinner: data[day].dinner ? { ...data[day].dinner, id: generateId(), mealType: MealType.DINNER } : null,
                };
            }
        }
        return processed as WeeklyPlan;

    } catch (error) {
        console.error("Error generating weekly plan:", error);
        return null;
    }
};
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";


async function generateSearchParams(query, tags, cuisines, ingredients) {
    const systemPrompt = `
You are a search query converter. Convert the user's natural language query into a structured search format.

Available Tags: ${tags}
Available Cuisines: ${cuisines}
Available Ingredients: ${ingredients}

Output a JSON object containing:
{
    "cuisines": [],
    "tags": [],
    "ingredients": []
}

Rules:
- Only use values from the available lists.
- Return empty arrays if no values apply.
- Tags use OR logic (match any tag).
- Cuisines use OR logic (match any cuisine).
- Ingredients use AND logic (match all ingredients).
- Infer related tags, cuisines and ingredients from the query.
- Keep ingredient names lowercase.
- Preserve the exact casing of available cuisines.
- Return ONLY valid JSON, without explanations or code fences.

Example input: "italian pasta with chicken and garlic"
Example output: {"cuisines":["Italian"],"ingredients":["chicken","garlic"],"tags":[]}

Example input: "quick no meat dinner"
Example output: {"cuisines":[],"ingredients":[],"tags":["quick","easy","vegetarian","vegan","dinner"]}

`;

    const aiResponse = await ai.models.generateContent({
        model: MODEL,
        contents: query,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseJsonSchema: {
                type: "object",
                properties: {
                    ingredients: {
                        type: "array",
                        items: { type: "string" }
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" }
                    },
                    cuisines: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["ingredients", "tags", "cuisines"]
            }
        }
    });

    const searchParams = JSON.parse(aiResponse.text);
    return searchParams;
}


async function generateRecipe(recipeText, availableCuisines, availableTags) {
    const systemPrompt = `
You are a professional chef and recipe generator.

Generate a complete recipe based on the user's description.

Available Cuisines: ${availableCuisines}
Available Tags: ${availableTags}

Return a JSON object containing:
{
    "name": "",
    "cuisine": "",
    "prepTime": 0,
    "cookTime": 0,
    "servings": 0,
    "ingredients": [
        {
            "name": "",
            "amount": 0,
            "unit": ""
        }
    ],
    "instructions": [],
    "tags": []
}

Rules:
- Use a cuisine from the available cuisines list.
- Only use tags from the available tags list.
- Prep time and cook time must be in minutes.
- Servings and ingredient amounts must be numbers.
- Ingredient names must be lowercase.
- Provide clear, step-by-step cooking instructions.
- Return ONLY valid JSON.

`;

    const aiResponse = await ai.models.generateContent({
        model: MODEL,
        contents: recipeText,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseJsonSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    cuisine: { type: "string" },
                    prepTime: { type: "number" },
                    cookTime: { type: "number" },
                    servings: { type: "number" },
                    ingredients: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                amount: { type: "number" },
                                unit: { type: "string" }
                            },
                            required: ["name", "amount", "unit"]
                        }
                    },
                    instructions: {
                        type: "array",
                        items: { type: "string" }
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: [
                    "name",
                    "cuisine",
                    "prepTime",
                    "cookTime",
                    "servings",
                    "ingredients",
                    "instructions",
                    "tags"
                ]
            }
        }
    });

    const recipe = JSON.parse(aiResponse.text);
    return recipe;
}

module.exports = {
    ai,
    MODEL,
    generateSearchParams,
    generateRecipe
};
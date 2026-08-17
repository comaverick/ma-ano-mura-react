const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const csvPath = path.resolve(
  __dirname,
  "../datasets/filipino_recipes.csv"
);


// =====================================================
// NORMALIZE
// =====================================================

function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[(),.-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bpieces?\b/g, "")
    .replace(/\bpcs?\b/g, "")
    .replace(/\bgrams?\b/g, "g")
    .replace(/\s+/g, " ")
    .trim();
}


// =====================================================
// ALIASES
// =====================================================

const aliases = {

  "mung bean": "Mungbean",
  "mung beans": "Mungbean",

  "garlic": "Garlic(Imported)",

  "tomato": "Tomato",
  "tomatoes": "Tomato",

  "ginger": "Ginger",
  "thumbs ginger": "Ginger",

  "calamansi": "Calamansi",

  "bell pepper": "Bell Pepper (Green)",
  "green bell pepper": "Bell Pepper (Green)",

  "bangus": "Bangus (Medium)",
  "bangus milkfish": "Bangus (Medium)",

  "string beans": "Habichuelas (Baguio Bean)",
  "sitaw": "Habichuelas (Baguio Bean)",

  "kangkong": "Kangkong",
  "kangkong leaves": "Kangkong",

  "okra": "Okra",

  "pork belly": "Pork Belly (Liempo)",

  "carrot": "Carrots",
  "potato": "White Potato",

  "onion": "White Onion",
  "yellow onion": "White Onion",

  "bay leaf": "Bay Leaf",
  "bay leaves": "Bay Leaf",
};


// =====================================================
// PARSE QUANTITY + INGREDIENT
// =====================================================

function parseIngredient(text) {

  let value = text
    .trim()
    .replace(/\s+/g, " ");

  let quantity = null;
  let unit = null;
  let name = value;


  // =====================================================
  // QUANTITY + UNIT
  // =====================================================

  const unitMatch = value.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞])\s*(kilograms?|kgs?|kg|grams?|g|pounds?|lbs?|ounces?|oz|quarts?|quart|tablespoons?|tbsp|teaspoons?|tsp|cups?|cup|cloves?|pieces?|pcs?|bunch(?:es)?|cans?|can|thumbs?|thumb)\.?(?=\s|$)\s*/i
  );


  if (unitMatch) {

    quantity = parseQuantity(
      unitMatch[1]
    );

    unit = unitMatch[2]
      .toLowerCase();

    name = value
      .substring(unitMatch[0].length)
      .trim();

  } else {

    // ===================================================
    // QUANTITY WITHOUT UNIT
    // ===================================================

    const quantityMatch = value.match(
      /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞])\s+(.+)$/i
    );


    if (quantityMatch) {

      quantity = parseQuantity(
        quantityMatch[1]
      );

      name = quantityMatch[2]
        .trim();

    }
  }


  // =====================================================
  // REMOVE PREPARATION INSTRUCTIONS
  // =====================================================

  name = name
    .replace(
      /\s+(cleaned|clean|washed|diced|cubed|sliced|chopped|crushed|julienned|wedged|frozen|quartered|halved|cut into|and)\b.*$/i,
      ""
    )
    .trim();


  // =====================================================
  // REMOVE DESCRIPTIVE WORDS
  // =====================================================

  name = name
    .replace(/^fresh\s+/i, "")
    .replace(/^whole\s+/i, "")
    .replace(/^medium\s+/i, "")
    .replace(/^large\s+/i, "")
    .replace(/^small\s+/i, "")
    .replace(/^dried\s+/i, "")
    .trim();


  // =====================================================
  // NORMALIZE COMMON NAMES
  // =====================================================

  const normalized =
    name.toLowerCase();


  if (normalized === "tomatoes") {
    name = "tomato";
  }

  if (normalized === "mung beans") {
    name = "mung bean";
  }

  if (normalized === "kangkong leaves") {
    name = "kangkong";
  }

  if (normalized === "bay leaves") {
    name = "bay leaf";
  }


  name = name
    .replace(/\s+and$/i, "")
    .trim();


  return {
    quantity,
    unit,
    name,
    original: value,
  };
}


// =====================================================
// PARSE QUANTITY
// =====================================================

function parseQuantity(value) {

  const fractions = {

    "½": 0.5,
    "¼": 0.25,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,

  };


  // 1 1/2

  if (value.includes(" ")) {

    const parts =
      value.split(" ");

    let result = 0;


    for (const part of parts) {

      if (part.includes("/")) {

        const [a, b] =
          part.split("/");

        result +=
          Number(a) / Number(b);

      } else if (
        !isNaN(Number(part))
      ) {

        result +=
          Number(part);

      }
    }


    return result;
  }


  // 1/2

  if (value.includes("/")) {

    const [a, b] =
      value.split("/");

    return Number(a) / Number(b);
  }


  // Unicode fraction

  if (
    fractions[value] !== undefined
  ) {

    return fractions[value];
  }


  return Number(value);
}


// =====================================================
// FIND INGREDIENT
// =====================================================

function findIngredient(
  ingredientName,
  ingredientMap
) {

  const normalized =
    normalizeName(
      ingredientName
    );


  // Exact match

  let match =
    ingredientMap.get(
      normalized
    );


  if (match) {
    return match;
  }


  // Alias match

  const alias =
    aliases[normalized];


  if (alias) {

    match =
      ingredientMap.get(
        normalizeName(alias)
      );

    if (match) {
      return match;
    }
  }


  return null;
}


// =====================================================
// MAIN
// =====================================================

async function run() {

  console.log(
    "Reading dataset...\n"
  );


  // =====================================================
  // READ CSV
  // =====================================================

  const csv =
    fs.readFileSync(
      csvPath,
      "utf8"
    );


  const recipes =
    parse(csv, {

      columns: true,

      skip_empty_lines: true,

    });


  console.log(
    `Found ${recipes.length} recipes.\n`
  );

  const testRecipes = recipes;


  // =====================================================
  // LOAD INGREDIENTS
  // =====================================================

  const {
    data: ingredients,
    error: ingredientError,
  } = await supabase

    .from("ingredients")

    .select(
      "id, name, unit, category"
    );


  if (ingredientError) {

    console.error(
      "Failed to load ingredients:",
      ingredientError
    );

    return;
  }


  console.log(
    `Loaded ${ingredients.length} ingredients from Supabase.\n`
  );


  // =====================================================
  // CREATE INGREDIENT LOOKUP
  // =====================================================

  const ingredientMap =
    new Map();


  for (
    const ingredient
    of ingredients
  ) {

    ingredientMap.set(

      normalizeName(
        ingredient.name
      ),

      ingredient
    );
  }


  // =====================================================
  // PROCESS RECIPES
  // =====================================================

  for (
    const recipe
    of testRecipes
  ) {

    console.log(
      "========================================"
    );

    console.log(
      `RECIPE: ${recipe.recipe_name}`
    );

    console.log(
      "========================================"
    );


    // ===================================================
    // CHECK IF RECIPE ALREADY EXISTS
    // ===================================================

    let insertedRecipe;


    const {
      data: existingRecipe,
      error: findRecipeError,
    } = await supabase

      .from("recipes")

      .select("*")

      .eq(
        "name",
        recipe.recipe_name
      )

      .limit(1)
      .maybeSingle();


    if (findRecipeError) {

      console.error(
        "Failed checking recipe:",
        findRecipeError
      );

      continue;
    }


    // ===================================================
    // USE EXISTING RECIPE
    // ===================================================

    if (existingRecipe) {

      insertedRecipe =
        existingRecipe;

      console.log(
        `✓ Recipe already exists: ${insertedRecipe.name}`
      );

    }


    // ===================================================
    // INSERT NEW RECIPE
    // ===================================================

    else {

      const {
        data: newRecipe,
        error: recipeError,
      } = await supabase

        .from("recipes")

        .insert({

          name:
            recipe.recipe_name,

          prep_time:
            recipe.prep_time || null,

          cook_time:
            recipe.cook_time || null,

          total_time:
            recipe.total_time || null,

          servings:
            recipe.servings
              ? parseInt(recipe.servings)
              : null,

          instructions:
            recipe.instructions || null,

        })

        .select()

        .single();


      if (recipeError) {

        console.error(
          "Recipe insert failed:",
          recipeError
        );

        continue;
      }


      insertedRecipe =
        newRecipe;

      console.log(
        `✓ Recipe inserted: ${insertedRecipe.name}`
      );
    }


    // ===================================================
    // GET INGREDIENTS
    // ===================================================

    const fullIngredients =
      recipe.ingredients

        .split("|")

        .map(
          (x) => x.trim()
        )

        .filter(Boolean);


    console.log(
      `Ingredients found: ${fullIngredients.length}`
    );


    // ===================================================
    // PROCESS INGREDIENTS
    // ===================================================

    for (
      const fullText
      of fullIngredients
    ) {

      const parsed =
        parseIngredient(
          fullText
        );


      const ingredient =
        findIngredient(
          parsed.name,
          ingredientMap
        );


      // =================================================
      // SKIP UNMATCHED
      // =================================================

      if (!ingredient) {

        console.log(
          `⚠ Skipped: ${parsed.name}`
        );

        continue;
      }


      // =================================================
      // CHECK EXISTING RELATIONSHIP
      // =================================================

      const {
        data: existingRelation,
        error: relationCheckError,
      } = await supabase

        .from("recipe_ingredients")

        .select("id")

        .eq(
          "recipe_id",
          insertedRecipe.id
        )

        .eq(
          "ingredient_id",
          ingredient.id
        )

        .limit(1)
        .maybeSingle();


      if (relationCheckError) {

        console.error(
          "Failed checking ingredient:",
          relationCheckError
        );

        continue;
      }


      // =================================================
      // ALREADY EXISTS
      // =================================================

      if (existingRelation) {

        console.log(
          `  ↪ Already exists: ${parsed.name}`
        );

        continue;
      }


      // =================================================
      // INSERT RELATIONSHIP
      // =================================================

      const {
        error: relationError,
      } = await supabase

        .from("recipe_ingredients")

        .insert({

          recipe_id:
            insertedRecipe.id,

          ingredient_id:
            ingredient.id,

          original_name:
            parsed.original,

          quantity:
            parsed.quantity,

          unit:
            parsed.unit,

        });


      if (relationError) {

        console.error(
          `✗ Failed: ${parsed.name}`,
          relationError
        );

      } else {

        console.log(
          `  ✓ ${parsed.name} → ${ingredient.name}`
        );
      }
    }


    console.log("");
  }


  // =====================================================
  // FINISHED
  // =====================================================

  console.log(
    "========================================"
  );

  console.log(
    "TEST IMPORT FINISHED"
  );

  console.log(
    "========================================"
  );
}


run();
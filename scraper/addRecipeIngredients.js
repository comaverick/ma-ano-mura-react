const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to add ingredients."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

const csvPath = path.resolve(__dirname, "../datasets/filipino_recipes.csv");
const recipes = parse(fs.readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

const candidates = [
  ["Pork", "KG", "Meat and Poultry"],
  ["Chicken", "KG", "Meat and Poultry"],
  ["Shrimp", "KG", "Fish"],
  ["Beef", "KG", "Meat and Poultry"],
  ["Bell Pepper", "KG", "Vegetables"],
  ["Green Onion", "KG", "Spices"],
  ["Cabbage", "KG", "Vegetables"],
  ["Butter", "KG", "Pantry"],
  ["Coconut Cream", "L", "Pantry"],
  ["Shrimp Paste", "L", "Pantry"],
  ["Canola Oil", "L", "Pantry"],
  ["Vegetable Oil", "L", "Pantry"],
  ["Olive Oil", "L", "Pantry"],
  ["Sesame Oil", "L", "Pantry"],
  ["Beef Broth", "L", "Pantry"],
  ["Chicken Broth", "L", "Pantry"],
  ["Banana Ketchup", "L", "Pantry"],
  ["Pineapple Juice", "L", "Pantry"],
  ["Cane Vinegar", "L", "Pantry"],
  ["Worcestershire Sauce", "L", "Pantry"],
  ["Mayonnaise", "L", "Pantry"],
  ["Margarine", "KG", "Pantry"],
  ["Spinach", "KG", "Vegetables"],
  ["Malunggay", "KG", "Vegetables"],
  ["Lemongrass", "KG", "Spices"],
  ["Cilantro", "KG", "Spices"],
  ["Star Anise", "KG", "Spices"],
  ["Milk", "L", "Pantry"],
  ["Kalabasa", "KG", "Vegetables"],
  ["Bok Choy", "KG", "Vegetables"],
  ["Kangkong", "KG", "Vegetables"],
  ["Okra", "KG", "Vegetables"],
  ["Chicken Liver", "KG", "Meat and Poultry"],
  ["Radish", "KG", "Vegetables"],
  ["Chorizo", "KG", "Meat and Poultry"],
  ["Green Papaya", "KG", "Vegetables"],
  ["Lemon", "KG", "Fruits"],
  ["Cheddar Cheese", "KG", "Pantry"],
  ["Paprika", "KG", "Spices"],
  ["Parsley", "KG", "Spices"],
  ["Pechay", "KG", "Vegetables"],
  ["Annatto Powder", "KG", "Spices"],
  ["Lumpia Wrapper", "KG", "Pantry"],
  ["Green Pea", "KG", "Vegetables"],
  ["Rice", "KG", "Rice"],
  ["Shallot", "KG", "Spices"],
  ["Raisin", "KG", "Pantry"],
  ["Peanut", "KG", "Pantry"],
  ["Peanut Butter", "KG", "Pantry"],
  ["Chicharon", "KG", "Pantry"],
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRecipeUsage() {
  const usage = new Map();

  for (const recipe of recipes) {
    const labels = String(recipe.ingredient_names || "")
      .split("|")
      .map((label) => normalize(label))
      .filter(Boolean);

    for (const label of labels) {
      usage.set(label, (usage.get(label) || 0) + 1);
    }
  }

  return usage;
}

async function main() {
  const { data: existing, error: existingError } = await supabase
    .from("ingredients")
    .select("name");

  if (existingError) {
    throw existingError;
  }

  const existingNames = new Set(existing.map((ingredient) => normalize(ingredient.name)));
  const usage = getRecipeUsage();
  const missing = candidates
    .filter(([name]) => !existingNames.has(normalize(name)))
    .map(([name, unit, category]) => ({
      name,
      unit,
      category,
      recipeUses: usage.get(normalize(name)) || 0,
    }));

  console.log(`Existing ingredients: ${existing.length}`);
  console.log(`Focused candidates: ${candidates.length}`);
  console.log(`Missing candidates: ${missing.length}`);
  console.table(missing);

  if (process.argv.includes("--dry-run") || missing.length === 0) {
    console.log("Dry run complete. Nothing was inserted.");
    return;
  }

  const rows = missing.map(({ name, unit, category }) => ({
    name,
    unit,
    category,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("ingredients")
    .insert(rows)
    .select("id, name, unit, category");

  if (insertError) {
    throw insertError;
  }

  console.log(`Inserted ${inserted.length} focused ingredients.`);
}

main().catch((error) => {
  console.error("Could not add recipe ingredients:", error);
  process.exit(1);
});

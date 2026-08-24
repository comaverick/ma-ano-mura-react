const fs = require("fs");
const path = require("path");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");
const aliases = require("./smAliases");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials are not configured.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

const productsPath = path.resolve(__dirname, "sm-food-products.json");
const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text, phrase) {
  if (!text || !phrase) {
    return false;
  }

  const optionalPlural = phrase.endsWith("s") ? "" : "s?";
  const pattern = new RegExp(
    `(^|\\s)${escapeRegExp(phrase)}${optionalPlural}(?=\\s|$)`,
    "i"
  );

  return pattern.test(text);
}

const safeAliasKeywords = new Set([
  "coconut milk",
  "coconut cream",
  "gata",
  "bagoong",
  "alamang",
  "magic sarap",
  "patis",
  "fish sauce",
  "oyster sauce",
  "shrimp paste",
  "liver spread",
  "sinigang",
  "sampalok",
  "chicken cubes",
  "pork cubes",
  "beef cubes",
  "black pepper",
  "peppercorn",
  "garlic powder",
  "bay leaf",
  "laurel",
  "bihon",
  "sotanghon",
  "vermicelli",
  "tomato sauce",
  "tomato paste",
  "all purpose cream",
]);

const processedFoodTerms = [
  "sauce",
  "paste",
  "catsup",
  "ketchup",
  "juice",
  "drink",
  "yogurt",
  "ice cream",
  "bread",
  "pandesal",
  "powder",
  "seasoning",
  "noodle",
  "ramen",
  "ramyun",
  "yakisoba",
  "koreno",
  "mami",
  "soup",
  "spread",
  "stock",
  "sinigang",
  "corned",
  "breaded",
  "nugget",
  "burger",
  "tapa",
  "tocino",
  "hotdog",
  "ham",
  "bacon",
  "sausage",
  "longanisa",
  "longaniza",
  "frank",
  "pancit",
  "siomai",
  "longganisa",
  "ready to cook",
  "rtc",
  "balls",
  "ball",
  "spring roll",
  "lumpia",
  "dumpling",
  "gyoza",
  "siopao",
  "tempura",
  "poppers",
  "popcorn",
  "cocktail",
  "tikoy",
  "stew",
  "mechado",
  "bulalo",
  "sisig",
  "pares",
  "yakiniku",
  "misono",
  "katsu",
  "fried",
  "teriyaki",
  "binagoongan",
  "humba",
  "shanghai",
  "bopis",
  "bulgogi",
  "gochujang",
  "relleno",
  "isaw",
  "barbecue",
  "salami",
  "pastrami",
  "franks",
  "luncheon",
  "hopia",
  "crackers",
  "wine",
  "tinapa",
  "tuna",
  "tom yum",
  "igado",
  "korean",
  "beand",
  "patties",
  "marinated",
  "food service",
  "processed",
  "pate",
  "kimchi",
  "cake",
  "square",
  "cookie",
  "brownie",
  "inipit",
  "wattatops",
  "paper",
  "salad",
  "oat",
  "milk tea",
  "soy milk",
  "chocolate",
  "rice noodle",
  "rice flour",
  "rice stick",
  "rice paper",
  "loaf",
  "beans",
  "neck",
  "feet",
  "spicy",
  "sardine",
  "canned",
  "whole peeled",
  "puree",
];

function isPlausibleMatch(product, ingredient) {
  const category = ingredient.category;
  const productName = normalize(product.name);
  const rawFoodCategories = new Set([
    "Vegetables",
    "Fruits",
    "Meat and Poultry",
    "Fish",
    "Rice",
  ]);

  if (
    rawFoodCategories.has(category) &&
    processedFoodTerms.some((term) => productName.includes(term))
  ) {
    return false;
  }

  if (
    normalize(ingredient.name) === "sinigang mix" &&
    (!/(mix|seasoning|powder)/.test(productName) ||
      /(salmon|fish|pork|beef|chicken|seafood|pack)/.test(productName))
  ) {
    return false;
  }

  const normalizedIngredient = normalize(ingredient.name);

  if (["beef", "pork", "chicken", "shrimp"].includes(normalizedIngredient)) {
    const rawProteinCues =
      normalizedIngredient === "shrimp"
        ? /(raw|peeled|shell|head|whole|cooked)/
        : /(raw|cut|slice|steak|ground|mince|loin|belly|shoulder|chop|leg|wing|thigh|breast|drumstick|whole|fillet)/;

    if (!rawProteinCues.test(productName)) {
      return false;
    }
  }

  if (
    normalizedIngredient === "peanut" &&
    /(peanut butter|peanut oil|peanut spread|tikoy|stew)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "raisin" &&
    /(bread|loaf|panderosa)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "shallot" &&
    /(oil|ginger)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "milk" &&
    /(drink|oat|soy|powder|chocolate)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "lemon" &&
    /(chicken|tuna|cake|cookie|square|juice)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "cilantro" &&
    /(salad|lime)/.test(productName)
  ) {
    return false;
  }

  if (
    normalizedIngredient === "paprika" &&
    /(sausage|arabiki|chic)/.test(productName)
  ) {
    return false;
  }

  return true;
}

async function run() {
  console.log(`Loaded ${products.length} SM food products.`);

  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, category");

  if (error) {
    console.error("Failed to load ingredients:", error);
    process.exit(1);
  }

  console.log(`Loaded ${ingredients.length} ingredients.`);

  const ingredientByName = new Map(
    ingredients.map((ingredient) => [normalize(ingredient.name), ingredient])
  );

  const directIngredients = ingredients
    .map((ingredient) => ({
      ingredient,
      name: normalize(ingredient.name),
    }))
    .filter((item) => item.name)
    .sort((a, b) => b.name.length - a.name.length);

  const aliasEntries = Object.entries(aliases)
    .map(([keyword, ingredientName]) => ({
      keyword: normalize(keyword),
      ingredientName: normalize(ingredientName),
    }))
    .filter((item) => safeAliasKeywords.has(item.keyword))
    .filter((item) => item.keyword && item.ingredientName)
    .sort((a, b) => b.keyword.length - a.keyword.length);

  function findIngredient(productName) {
    const normalizedProductName = normalize(productName);

    // Longer direct ingredient names win first. This prevents tomato sauce
    // from being classified as tomato when both exist in the catalog.
    const directMatch = directIngredients.find(
      (item) =>
        hasPhrase(normalizedProductName, item.name) &&
        isPlausibleMatch(
          { name: productName },
          item.ingredient
        )
    );

    if (directMatch) {
      return directMatch.ingredient;
    }

    const aliasMatch = aliasEntries.find(
      (item) =>
        hasPhrase(normalizedProductName, item.keyword) &&
        ingredientByName.has(item.ingredientName) &&
        isPlausibleMatch(
          { name: productName },
          ingredientByName.get(item.ingredientName)
        )
    );

    return aliasMatch
      ? ingredientByName.get(aliasMatch.ingredientName) || null
      : null;
  }

  const matched = [];
  const unmatched = [];

  for (const product of products) {
    const ingredient = findIngredient(product.name);

    if (!ingredient) {
      unmatched.push(product);
      continue;
    }

    matched.push({
      ...product,
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
    });
  }

  console.log("================================");
  console.log(`MATCHED: ${matched.length}`);
  console.log(`UNMATCHED: ${unmatched.length}`);
  console.log("================================");

  const matchedPath = path.resolve(__dirname, "sm-matched.json");
  const unmatchedPath = path.resolve(__dirname, "sm-unmatched.json");

  fs.writeFileSync(matchedPath, JSON.stringify(matched, null, 2));
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatched, null, 2));

  console.log("\nSaved:");
  console.log(matchedPath);
  console.log(unmatchedPath);
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { normalizeName } = require("../src/domain/ingredientCatalog.js");
const rows = parse(
  fs.readFileSync(
    path.join(__dirname, "../datasets/filipino_recipes.csv"),
    "utf8",
  ),
  { columns: true, skip_empty_lines: true },
);
const recipes = new Map();
for (const row of rows) {
  const key = normalizeName(row.recipe_name);
  if (!key) continue;
  const recipe = {
    name: row.recipe_name.trim(),
    prep_time: row.prep_time || null,
    cook_time: row.cook_time || null,
    total_time: row.total_time || null,
    servings: parseInt(row.servings, 10) || null,
    ingredients: String(row.ingredients || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean),
    instructions: String(row.instructions || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const previous = recipes.get(key);
  if (!previous || recipe.ingredients.length > previous.ingredients.length)
    recipes.set(key, recipe);
}
const output = Object.fromEntries(
  [...recipes].sort(([a], [b]) => a.localeCompare(b)),
);
const target = path.join(__dirname, "../src/data/recipes.json");
fs.writeFileSync(target, JSON.stringify(output) + "\n");
console.log(
  `Prepared ${recipes.size} unique recipes from ${rows.length} CSV rows.`,
);

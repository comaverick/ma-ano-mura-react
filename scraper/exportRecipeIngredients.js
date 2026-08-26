const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const csvPath = path.resolve(__dirname, "../datasets/filipino_recipes.csv");
const outputPath = path.resolve(
  __dirname,
  "../src/data/recipeIngredients.json"
);

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const rows = parse(fs.readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

const recipes = {};

for (const row of rows) {
  const recipeName = String(row.recipe_name || "").trim();

  if (!recipeName) {
    continue;
  }

  const existing = recipes[recipeName] || [];
  const known = new Set(existing.map(normalize));
  const ingredients = String(row.ingredients || "")
    .split("|")
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);

  for (const ingredient of ingredients) {
    if (!known.has(normalize(ingredient))) {
      existing.push(ingredient);
      known.add(normalize(ingredient));
    }
  }

  recipes[recipeName] = existing;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ recipes })}\n`,
  "utf8"
);

console.log(
  `Exported raw ingredients for ${Object.keys(recipes).length} recipes to ${outputPath}.`
);

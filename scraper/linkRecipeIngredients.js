const fs = require("fs");
const path = require("path");
const { getClient, fetchAll } = require("./lib/client");
const { targetIngredient } = require("./lib/persistence");
const {
  normalizeName,
  resolveIngredient,
} = require("../src/domain/ingredientCatalog.js");
const { parseIngredientText } = require("../src/domain/recipeParser.js");
const { convertQuantity } = require("../src/domain/costing.js");
function desiredRecipeLinks(recipes, ingredients, source) {
  const byName = new Map(recipes.map((row) => [normalizeName(row.name), row]));
  const desired = new Map();
  const unresolved = new Map();
  for (const recipe of Object.values(source)) {
    const dbRecipe = byName.get(normalizeName(recipe.name));
    if (!dbRecipe) continue;
    for (const raw of recipe.ingredients) {
      const parsed = parseIngredientText(raw);
      if (parsed.isWater) continue;
      const definition = resolveIngredient(parsed.name);
      const ingredient =
        definition && targetIngredient(ingredients, definition);
      if (!ingredient) {
        unresolved.set(parsed.name, (unresolved.get(parsed.name) || 0) + 1);
        continue;
      }
      const converted = convertQuantity(
        parsed.quantity,
        parsed.unit,
        definition,
      );
      const key = `${dbRecipe.id}:${ingredient.id}`;
      let link = desired.get(key);
      if (!link) {
        link = {
          recipe_id: dbRecipe.id,
          ingredient_id: ingredient.id,
          originals: [],
          quantity: null,
          unit: definition.unit,
        };
        desired.set(key, link);
      }
      link.originals.push(raw);
      if (converted.amount !== null)
        link.quantity = (link.quantity || 0) + converted.amount;
    }
  }
  return {
    rows: [...desired.values()].map(({ originals, ...row }) => ({
      ...row,
      original_name: originals.join(" | "),
    })),
    unresolved: [...unresolved].sort((a, b) => b[1] - a[1]),
  };
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getClient();
  const [recipes, ingredients, current] = await Promise.all([
    fetchAll(client, "recipes", "id,name"),
    fetchAll(client, "ingredients", "id,name,unit,category"),
    fetchAll(
      client,
      "recipe_ingredients",
      "id,recipe_id,ingredient_id,original_name,quantity,unit",
    ),
  ]);
  const result = desiredRecipeLinks(
    recipes,
    ingredients,
    require("../src/data/recipes.json"),
  );
  const byKey = new Map();
  for (const link of current) {
    const key = `${link.recipe_id}:${link.ingredient_id}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(link);
  }
  const inserts = [],
    updates = [];
  for (const row of result.rows) {
    const existing = byKey.get(`${row.recipe_id}:${row.ingredient_id}`);
    if (!existing) {
      inserts.push(row);
      continue;
    }
    for (const old of existing) {
      const next = { ...row, id: old.id };
      if (row.quantity === null) {
        next.quantity = old.quantity;
        next.unit = old.unit;
      }
      if (
        Number(old.quantity) !== Number(next.quantity) ||
        old.unit !== next.unit ||
        old.original_name !== next.original_name
      )
        updates.push(next);
    }
  }
  const report = {
    desired: result.rows.length,
    inserts: inserts.length,
    updates: updates.length,
    unresolved: result.unresolved,
  };
  const dir = path.join(process.env.SCRAPER_OUTPUT_DIR || __dirname, "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "recipe-links.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Recipe links: ${result.rows.length} resolved; ${inserts.length} to insert; ${updates.length} to update.`,
  );
  if (dryRun) return;
  for (let i = 0; i < updates.length; i += 200) {
    const { error } = await client
      .from("recipe_ingredients")
      .upsert(updates.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const { error } = await client
      .from("recipe_ingredients")
      .insert(inserts.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error("Recipe ingredient sync failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { desiredRecipeLinks };

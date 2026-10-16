const fs = require("fs");
const path = require("path");
const { getClient, fetchAll } = require("./lib/client");
const {
  createPriceIndex,
  priceRecipe,
  getLatestPrice,
} = require("../src/domain/costing.js");
const { catalog } = require("../src/domain/ingredientCatalog.js");
function audit(ingredients, prices, recipes) {
  const byIngredient = new Map();
  for (const price of prices) {
    if (!byIngredient.has(price.ingredient_id))
      byIngredient.set(price.ingredient_id, []);
    byIngredient.get(price.ingredient_id).push(price);
  }
  const index = createPriceIndex(
    ingredients.map((item) => ({
      ...item,
      prices: byIngredient.get(item.id) || [],
    })),
  );
  const stats = {
    recipes: recipes.length,
    catalogDefinitions: catalog.length,
    ingredientsWithQuotes: [...index.values()].filter((row) =>
      getLatestPrice(row),
    ).length,
    requiredIngredientRows: 0,
    pricedIngredientRows: 0,
    fullyPricedRecipes: 0,
    missingByReason: {},
    unmatched: [],
    unpriced: [],
  };
  const unmatched = new Map(),
    unpriced = new Map();
  for (const recipe of recipes) {
    const result = priceRecipe(recipe, index);
    stats.requiredIngredientRows += result.requiredCount;
    stats.pricedIngredientRows += result.pricedCount;
    if (result.coverage === 100) stats.fullyPricedRecipes++;
    for (const row of result.missing) {
      stats.missingByReason[row.status] =
        (stats.missingByReason[row.status] || 0) + 1;
      const map = row.status === "unmatched" ? unmatched : unpriced;
      const name = row.definition?.name || row.parsed.name || row.rawName;
      map.set(name, (map.get(name) || 0) + 1);
    }
  }
  stats.coveragePercent = Number(
    (
      (stats.pricedIngredientRows / Math.max(stats.requiredIngredientRows, 1)) *
      100
    ).toFixed(2),
  );
  stats.unmatched = [...unmatched].sort((a, b) => b[1] - a[1]);
  stats.unpriced = [...unpriced].sort((a, b) => b[1] - a[1]);
  stats.sources = Object.fromEntries(
    ["DA Pricewatch", "SM Supermarkets"].map((source) => [
      source,
      {
        ingredients: [...index.values()].filter((row) =>
          getLatestPrice(row, source),
        ).length,
        latest:
          prices
            .filter((p) => (p.source || "DA Pricewatch") === source)
            .map((p) => p.date)
            .sort()
            .at(-1) || null,
      },
    ]),
  );
  return stats;
}
async function main() {
  const prefix = process.argv
    .find((arg) => arg.startsWith("--snapshot-prefix="))
    ?.split("=")[1];
  let ingredients, prices;
  if (prefix) {
    ingredients = JSON.parse(fs.readFileSync(`${prefix}-ingredients.json`));
    prices = JSON.parse(fs.readFileSync(`${prefix}-prices.json`));
  } else {
    const client = getClient();
    [ingredients, prices] = await Promise.all([
      fetchAll(client, "ingredients", "id,name,unit,category"),
      fetchAll(
        client,
        "prices",
        "id,ingredient_id,avg_price,date,source,location_id",
      ),
    ]);
  }
  const report = audit(
    ingredients,
    prices,
    Object.values(require("../src/data/recipes.json")),
  );
  const dir = path.join(process.env.SCRAPER_OUTPUT_DIR || __dirname, "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "coverage.json"),
    JSON.stringify(
      { ...report, generatedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  const { unmatched, unpriced, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  console.log("Most common unrecognized recipe text:", unmatched.slice(0, 10));
  if (!prices.length || report.pricedIngredientRows === 0)
    throw new Error("No usable price data in the coverage audit");
}
if (require.main === module)
  main().catch((error) => {
    console.error("Coverage audit failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { audit };

const fs = require("fs");
const path = require("path");
const { getClient, fetchAll } = require("./lib/client");
const {
  createPriceIndex,
  getLatestPrice,
} = require("../src/domain/costing.js");
const { catalog } = require("../src/domain/ingredientCatalog.js");
const { summarizeCoverage } = require("../src/domain/coverage.js");
const { evaluateQuality, writeQualityReport } = require("./lib/quality");
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
  const summary = summarizeCoverage(recipes, index);
  const aggregate = (statuses) => {
    const counts = new Map();
    for (const gap of summary.priorities.filter((item) =>
      statuses.includes(item.status),
    ))
      counts.set(gap.name, (counts.get(gap.name) || 0) + gap.rows);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  return {
    ...summary,
    catalogDefinitions: catalog.length,
    ingredientsWithQuotes: [...index.values()].filter((entry) =>
      getLatestPrice(entry),
    ).length,
    unmatched: aggregate(["unmatched"]),
    unpriced: aggregate(["quantity", "no-price"]),
  };
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
  const { priorities, ...brief } = summary;
  console.log(JSON.stringify(brief, null, 2));
  console.log("Most common unrecognized recipe text:", unmatched.slice(0, 10));
  const baselinePath = process.argv
    .find((arg) => arg.startsWith("--baseline="))
    ?.slice("--baseline=".length);
  let baseline = null;
  if (baselinePath && fs.existsSync(baselinePath))
    baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const quality = evaluateQuality({ report, prices, ingredients, baseline });
  writeQualityReport(quality, report, dir);
  if (quality.errors.length) process.exitCode = 1;
  if (!prices.length || report.pricedIngredientRows === 0)
    throw new Error("No usable price data in the coverage audit");
}
if (require.main === module)
  main().catch((error) => {
    console.error("Coverage audit failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { audit };

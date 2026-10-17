import { priceRecipe, getLatestPrice } from "./costing.js";
import { normalizeName } from "./ingredientCatalog.js";
const actions = {
  unmatched: "Add a verified ingredient definition and source match",
  "no-price": "Find a valid in-stock source quote",
  quantity: "Review recipe quantity or unit conversion",
};
function summarizeCoverage(recipes, index) {
  let required = 0,
    priced = 0,
    complete = 0;
  const missingByReason = {};
  const gaps = new Map();
  for (const recipe of recipes) {
    const cost = priceRecipe(recipe, index);
    required += cost.requiredCount;
    priced += cost.pricedCount;
    if (cost.requiredCount && !cost.missing.length) complete++;
    for (const row of cost.missing) {
      missingByReason[row.status] = (missingByReason[row.status] || 0) + 1;
      const name = row.definition?.name || row.parsed.name || row.rawName;
      const key = `${row.status}:${row.definition?.key || normalizeName(name)}`;
      const gap = gaps.get(key) || {
        key,
        name,
        status: row.status,
        rows: 0,
        recipes: new Set(),
        examples: new Set(),
        action: actions[row.status],
      };
      gap.rows++;
      gap.recipes.add(recipe.key || normalizeName(recipe.name));
      if (gap.examples.size < 3) gap.examples.add(row.rawName);
      gaps.set(key, gap);
    }
  }
  const priorities = [...gaps.values()]
    .map((gap) => ({
      ...gap,
      recipes: gap.recipes.size,
      examples: [...gap.examples],
    }))
    .sort(
      (a, b) =>
        b.recipes - a.recipes ||
        b.rows - a.rows ||
        a.name.localeCompare(b.name),
    );
  const sources = Object.fromEntries(
    ["DA Pricewatch", "SM Supermarkets"].map((source) => {
      const quotes = [...index.values()]
        .map((entry) => getLatestPrice(entry, source))
        .filter(Boolean);
      return [
        source,
        {
          ingredients: quotes.length,
          latest:
            quotes
              .map((price) => price.date)
              .sort()
              .at(-1) || null,
        },
      ];
    }),
  );
  return {
    recipes: recipes.length,
    requiredIngredientRows: required,
    pricedIngredientRows: priced,
    fullyPricedRecipes: complete,
    coveragePercent: Number(
      ((priced / Math.max(required, 1)) * 100).toFixed(2),
    ),
    missingByReason,
    priorities,
    sources,
  };
}
export { summarizeCoverage };
const api = { summarizeCoverage };
export default api;

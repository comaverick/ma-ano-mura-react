const { matchProduct } = require("./productMatching");
const { normalizeProductPrice } = require("./priceNormalization");
const { targetIngredient, LOCATION_ID, manilaDate } = require("./persistence");
function prepareSMPrices(
  products,
  ingredients,
  { date = manilaDate(), requireFresh = true } = {},
) {
  const best = new Map();
  const unmatched = [];
  const rejected = [];
  let matched = 0;
  for (const product of products) {
    const definition = matchProduct(product);
    if (!definition) {
      unmatched.push({ name: product.name, category: product.source_category });
      continue;
    }
    matched++;
    if (
      requireFresh &&
      (!product.observed_at ||
        manilaDate(new Date(product.observed_at)) !== date)
    ) {
      rejected.push({
        name: product.name,
        reason: "No observation from this Manila date",
      });
      continue;
    }
    const normalized = normalizeProductPrice(product, definition);
    if (normalized.reason) {
      rejected.push({
        name: product.name,
        ingredient: definition.name,
        reason: normalized.reason,
      });
      continue;
    }
    const ingredient = targetIngredient(ingredients, definition);
    if (!ingredient) {
      rejected.push({
        name: product.name,
        ingredient: definition.name,
        reason: "Ingredient is not in the database catalog",
      });
      continue;
    }
    const previous = best.get(ingredient.id);
    if (!previous || normalized.unitPrice < previous.normalized.unitPrice)
      best.set(ingredient.id, { ingredient, definition, product, normalized });
  }
  const selected = [...best.values()];
  const rows = selected.map(({ ingredient, normalized }) => ({
    ingredient_id: ingredient.id,
    location_id: LOCATION_ID,
    avg_price: Number(normalized.unitPrice.toFixed(2)),
    date,
    source: "SM Supermarkets",
  }));
  return {
    rows,
    selected,
    report: {
      source: "SM Supermarkets",
      date,
      products: products.length,
      matchedProducts: matched,
      pricedIngredients: rows.length,
      rejected,
      unmatched,
      quotes: selected.map(({ ingredient, product, normalized }) => ({
        ingredient: ingredient.name,
        product: product.name,
        url: product.url,
        observedAt: product.observed_at,
        ...normalized,
      })),
    },
  };
}
module.exports = { prepareSMPrices };

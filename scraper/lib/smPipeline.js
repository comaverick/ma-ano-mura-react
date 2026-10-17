const { matchProduct } = require("./productMatching");
const { normalizeProductPrice } = require("./priceNormalization");
const {
  targetIngredient,
  SM_LOCATION_ID,
  manilaDate,
} = require("./persistence");
function prepareSMPrices(
  products,
  ingredients,
  { date = manilaDate(), requireFresh = true } = {},
) {
  const best = new Map();
  const unmatched = [];
  const rejected = [];
  const offers = [];
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
    if (!/\b(?:per\s*(?:kg|kilo)|average\s+weight)\b/i.test(product.name))
      offers.push({
        ingredientKey: definition.key,
        ingredientId: ingredient.id,
        product: product.name,
        sku: String(product.sku || product.url),
        url: product.url,
        packPrice: Number(product.price),
        baseAmount: normalized.baseAmount,
        unit: definition.unit,
        date,
        estimated: normalized.estimated,
        variable: !!normalized.variable,
        ...(normalized.variable
          ? {
              unitPriceLow: normalized.unitPriceLow,
              unitPriceHigh: normalized.unitPriceHigh,
            }
          : {}),
        package: normalized.package,
      });
    if (!previous || normalized.unitPrice < previous.normalized.unitPrice)
      best.set(ingredient.id, { ingredient, definition, product, normalized });
  }
  const selected = [...best.values()];
  const rows = selected.map(({ ingredient, normalized }) => ({
    ingredient_id: ingredient.id,
    location_id: SM_LOCATION_ID,
    avg_price: Number(normalized.unitPrice.toFixed(2)),
    date,
    source: "SM Supermarkets",
  }));
  return {
    rows,
    selected,
    offers,
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
        sku: product.sku,
        packPrice: Number(product.price),
        ...normalized,
      })),
    },
  };
}
module.exports = { prepareSMPrices };

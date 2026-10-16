import {
  byKey,
  normalizeName,
  resolveIngredient,
  catalogForMarket,
} from "./ingredientCatalog.js";
import { parseIngredientText } from "./recipeParser.js";
const PRICE_SOURCES = [
  { value: "best", label: "Lowest available" },
  { value: "DA Pricewatch", label: "DA Pricewatch" },
  { value: "SM Supermarkets", label: "SM Supermarket" },
];
const WEIGHTS = { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.028349523125 };
const VOLUMES = {
  l: 1,
  ml: 0.001,
  cup: 0.2365882365,
  quart: 0.946352946,
  tbsp: 0.0147867648,
  tsp: 0.00492892159,
};
function convertQuantity(quantity, unit, definition) {
  const amount = Number(quantity);
  const target = definition?.unit;
  const fail = (reason) => ({
    amount: null,
    baseUnit: target,
    estimated: false,
    reason,
  });
  const ok = (value, reason = "") => ({
    amount: value,
    baseUnit: target,
    estimated: !!reason,
    reason,
  });
  if (quantity == null || !Number.isFinite(amount) || amount <= 0)
    return fail("No quantity specified");
  if (!definition) return fail("Ingredient not yet recognized");
  if (unit === target) return ok(amount);
  if (target === "kg" && WEIGHTS[unit]) return ok(amount * WEIGHTS[unit]);
  if (target === "l" && VOLUMES[unit]) return ok(amount * VOLUMES[unit]);
  if (target === "kg" && VOLUMES[unit]) {
    if (definition.cupGrams)
      return ok(
        (((amount * VOLUMES[unit]) / VOLUMES.cup) * definition.cupGrams) / 1000,
        "Uses an average weight per cup",
      );
    if (definition.density)
      return ok(
        amount * VOLUMES[unit] * definition.density,
        "Uses an estimated ingredient density",
      );
    return fail("Volume-to-weight conversion unavailable");
  }
  if (target === "l" && WEIGHTS[unit] && definition.density)
    return ok(
      (amount * WEIGHTS[unit]) / definition.density,
      "Uses an estimated ingredient density",
    );
  if (target === "piece" && ["piece", "clove"].includes(unit))
    return ok(amount);
  if (
    target === "kg" &&
    ["piece", "clove", "thumb", "bunch", "head", "stalk"].includes(unit)
  ) {
    let grams = definition.pieceGrams;
    if (definition.key === "garlic" && unit === "head") grams = 45;
    if (definition.key === "ginger" && unit === "thumb") grams = 15;
    if (
      unit === "bunch" &&
      ["green onion", "cilantro", "parsley", "lemongrass"].includes(
        definition.key,
      )
    )
      grams = 100;
    if (grams)
      return ok((amount * grams) / 1000, `Uses an average ${unit} weight`);
  }
  return fail(
    ["can", "pack"].includes(unit)
      ? "Package weight is not specified"
      : "Unit conversion unavailable",
  );
}
function validPrice(price) {
  return (
    price?.avg_price !== null &&
    price?.avg_price !== undefined &&
    Number.isFinite(Number(price.avg_price)) &&
    Number(price.avg_price) > 0 &&
    /^\d{4}-\d{2}-\d{2}/.test(String(price.date)) &&
    Number.isFinite(Date.parse(price.date))
  );
}
function newestBySource(prices) {
  const map = new Map();
  for (const price of prices || []) {
    if (!validPrice(price)) continue;
    const source = price.source || "DA Pricewatch";
    const current = map.get(source);
    if (
      !current ||
      price.date > current.date ||
      (price.date === current.date &&
        Number(price.avg_price) < Number(current.avg_price))
    )
      map.set(source, { ...price, source });
  }
  return [...map.values()];
}
function getLatestPrice(ingredient, source = "best") {
  let latest = newestBySource(ingredient?.currentPrices || ingredient?.prices);
  if (source !== "best") return latest.find((p) => p.source === source) || null;
  // Compare each source's latest quote, and avoid choosing an old low price when
  // a much newer quote exists. Dates remain visible even when all data is stale.
  const newest = Math.max(...latest.map((p) => Date.parse(p.date)));
  latest = latest.filter((p) => newest - Date.parse(p.date) <= 7 * 86400000);
  return (
    latest.sort(
      (a, b) =>
        Number(a.avg_price) - Number(b.avg_price) ||
        b.date.localeCompare(a.date),
    )[0] || null
  );
}
function marketPriceInBase(price, ingredient, definition) {
  const unit = String(ingredient.unit || "").toLowerCase();
  if (definition.unit === "l") {
    const size = unit.match(/([\d.]+)\s*(ml|milliliter|l\b|liter)/);
    if (size) {
      const volume = +size[1] * (size[2].startsWith("m") ? 0.001 : 1);
      if (volume > 0) return Number(price.avg_price) / volume;
    }
  }
  return Number(price.avg_price);
}
function createPriceIndex(ingredients) {
  const index = new Map();
  for (const ingredient of ingredients || []) {
    const definition = catalogForMarket(ingredient) || {
      key: normalizeName(ingredient.name),
      name: ingredient.name,
      category: ingredient.category || "Other Commodities",
      unit: /^(?:l|\d+\s*(?:ml|liter))/i.test(String(ingredient.unit))
        ? "l"
        : "kg",
      aliases: [normalizeName(ingredient.name)],
    };
    // Keep the large-egg reference consistent; peewee/medium eggs are different sizes.
    if (
      definition.key === "chicken egg" &&
      /egg \(/.test(ingredient.name.toLowerCase()) &&
      !/\blarge\b/i.test(ingredient.name)
    )
      continue;
    if (
      definition.key === "chicken egg" &&
      /extra large/i.test(ingredient.name)
    )
      continue;
    const prices = (ingredient.prices || [])
      .filter(validPrice)
      .map((price) => ({
        ...price,
        avg_price: marketPriceInBase(price, ingredient, definition),
        ingredientName: ingredient.name,
        ingredientId: ingredient.id,
        unit: definition.unit,
      }));
    const entry = index.get(definition.key) || { definition, prices: [] };
    entry.prices.push(...prices);
    index.set(definition.key, entry);
  }
  for (const [parent, children] of Object.entries({
    pork: ["pork ham kasim", "pork belly liempo"],
    beef: ["beef brisket", "beef rump"],
  })) {
    let entry = index.get(parent);
    if (!entry && children.every((child) => !index.has(child))) continue;
    if (!entry) {
      entry = { definition: byKey.get(parent), prices: [] };
      index.set(parent, entry);
    }
    for (const child of children) {
      for (const price of index.get(child)?.prices || [])
        entry.prices.push({ ...price, reference: true });
    }
  }
  const latestSMDate = [...index.values()]
    .flatMap((entry) => entry.prices)
    .filter((price) => price.source === "SM Supermarkets")
    .map((price) => price.date)
    .sort()
    .at(-1);
  for (const entry of index.values()) {
    // SM is a complete daily in-stock catalog snapshot. Do not carry an item
    // missing from that snapshot forward from an older collection or matcher.
    entry.currentPrices = entry.prices.filter(
      (price) =>
        price.source !== "SM Supermarkets" || price.date === latestSMDate,
    );
  }
  return index;
}
function priceRecipe(recipe, index, source = "best", servingsOverride = null) {
  const raw = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : String(recipe.ingredients || "")
        .split("|")
        .filter(Boolean);
  const rows = raw.map((line, i) => {
    const parsed = parseIngredientText(line);
    const definition = resolveIngredient(parsed.name);
    const entry = definition ? index.get(definition.key) : null;
    const price = getLatestPrice(entry, source);
    let conversion = convertQuantity(parsed.quantity, parsed.unit, definition);
    if (parsed.estimated && conversion.amount !== null)
      conversion = {
        ...conversion,
        estimated: true,
        reason: [
          conversion.reason,
          "Uses the midpoint of the listed quantity range",
        ]
          .filter(Boolean)
          .join("; "),
      };
    if (price?.reference && conversion.amount !== null)
      conversion = {
        ...conversion,
        estimated: true,
        reason: [
          conversion.reason,
          `Uses ${price.ingredientName} as a ${definition.name.toLowerCase()} reference`,
        ]
          .filter(Boolean)
          .join("; "),
      };
    const unmeasured = parsed.quantity == null;
    const cost =
      price && conversion.amount !== null
        ? Number(price.avg_price) * conversion.amount
        : null;
    const status = parsed.isWater
      ? "water"
      : unmeasured &&
          (parsed.toTaste || /\b(salt|pepper|fish sauce)\b/i.test(parsed.name))
        ? "to-taste"
        : !definition
          ? "unmatched"
          : !price
            ? "no-price"
            : conversion.amount === null
              ? "quantity"
              : "priced";
    return {
      id: `ingredient-${i}`,
      rawName: line,
      parsed,
      definition,
      price,
      conversion,
      cost: status === "water" ? null : cost,
      status,
    };
  });
  const baseServings = Number(recipe.servings);
  const requested = Number(servingsOverride);
  const scale =
    baseServings > 0 && requested > 0 ? requested / baseServings : 1;
  const scaled = rows.map((row) => ({
    ...row,
    cost: row.cost === null ? null : row.cost * scale,
    quantity: row.parsed.quantity === null ? null : row.parsed.quantity * scale,
  }));
  const required = scaled.filter(
    (row) => !["water", "to-taste"].includes(row.status),
  );
  const priced = required.filter((row) => row.cost !== null);
  return {
    rows: scaled,
    total: priced.reduce((sum, row) => sum + row.cost, 0),
    pricedCount: priced.length,
    requiredCount: required.length,
    missing: required.filter((row) => row.cost === null),
    coverage: required.length
      ? Math.round((priced.length / required.length) * 100)
      : 0,
    servings: requested > 0 ? requested : baseServings || null,
    estimated: scaled.some(
      (row) => row.cost !== null && row.conversion.estimated,
    ),
  };
}
export {
  PRICE_SOURCES,
  WEIGHTS,
  VOLUMES,
  convertQuantity,
  validPrice,
  newestBySource,
  getLatestPrice,
  createPriceIndex,
  priceRecipe,
  marketPriceInBase,
  normalizeName,
  resolveIngredient,
  byKey,
};
const api = {
  PRICE_SOURCES,
  WEIGHTS,
  VOLUMES,
  convertQuantity,
  validPrice,
  newestBySource,
  getLatestPrice,
  createPriceIndex,
  priceRecipe,
  marketPriceInBase,
  normalizeName,
  resolveIngredient,
  byKey,
};

export default api;

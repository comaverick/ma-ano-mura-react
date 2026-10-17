import { priceRecipe, WEIGHTS, VOLUMES } from "./costing.js";
import { byKey, normalizeName } from "./ingredientCatalog.js";
import { cleanMeasurements, withMeasurements } from "./measurements.js";

const STORAGE_KEY = "ma-ano-mura:kitchen:v1";
const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner"];
const recipeKey = (recipe) => normalizeName(recipe.key || recipe.name);
const positive = (value, max = 100) =>
  Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= max;
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
function cleanKitchen(value) {
  const input = value && typeof value === "object" ? value : {};
  const strings = (items) =>
    [
      ...new Set(
        Array.isArray(items)
          ? items.filter(
              (item) => typeof item === "string" && item.length <= 200,
            )
          : [],
      ),
    ].slice(0, 3000);
  const plans = new Map();
  for (const item of Array.isArray(input.plans) ? input.plans : []) {
    if (
      item &&
      validDate(item.date) &&
      MEAL_SLOTS.includes(item.slot) &&
      typeof item.recipeKey === "string" &&
      item.recipeKey.length <= 200 &&
      positive(item.servings)
    )
      plans.set(`${item.date}:${item.slot}`, {
        date: item.date,
        slot: item.slot,
        recipeKey: item.recipeKey,
        servings: Number(item.servings),
        ...(item.recipe &&
        typeof item.recipe.name === "string" &&
        item.recipe.name.length <= 200 &&
        positive(item.recipe.servings) &&
        Array.isArray(item.recipe.ingredients) &&
        item.recipe.ingredients.length > 0 &&
        item.recipe.ingredients.length <= 100 &&
        item.recipe.ingredients.every(
          (line) => typeof line === "string" && line.length <= 1000,
        )
          ? {
              recipe: {
                name: item.recipe.name,
                key: item.recipeKey,
                servings: Number(item.recipe.servings),
                ingredients: item.recipe.ingredients,
              },
            }
          : {}),
      });
  }
  const budgets = Object.fromEntries(
    Object.entries(
      input.budgets && typeof input.budgets === "object" ? input.budgets : {},
    )
      .filter(([day, amount]) => validDate(day) && positive(amount, 1000000))
      .map(([day, amount]) => [day, Number(amount)]),
  );
  return {
    favorites: strings(input.favorites),
    pantry: strings(input.pantry).filter((key) => byKey.has(key)),
    plans: [...plans.values()].slice(-1000),
    checked: strings(input.checked),
    budgets,
    measurements: cleanMeasurements(input.measurements),
  };
}
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function shiftDate(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}
function weekStart(day = localDate()) {
  const date = new Date(`${day}T12:00:00`);
  return shiftDate(day, -((date.getDay() + 6) % 7));
}
function assessRecipe(
  recipe,
  index,
  {
    servings = recipe.servings,
    source = "best",
    pantry = [],
    now = Date.now(),
    baseCost = null,
  } = {},
) {
  let cost;
  if (baseCost) {
    const scale =
      Number(baseCost.servings) > 0 && Number(servings) > 0
        ? Number(servings) / Number(baseCost.servings)
        : 1;
    const rows = baseCost.rows.map((row) => ({
      ...row,
      cost: row.cost === null ? null : row.cost * scale,
      quantity: row.quantity === null ? null : row.quantity * scale,
    }));
    cost = {
      ...baseCost,
      rows,
      total: baseCost.total * scale,
      servings: Number(servings) > 0 ? Number(servings) : baseCost.servings,
      missing: rows.filter(
        (row) =>
          !["water", "to-taste"].includes(row.status) && row.cost === null,
      ),
    };
  } else cost = priceRecipe(recipe, index, source, servings);
  const owned = new Set(pantry);
  const required = cost.rows.filter(
    (row) => !["water", "to-taste"].includes(row.status),
  );
  const toBuy = required.filter((row) => !owned.has(row.definition?.key));
  const missing = toBuy.filter((row) => row.cost === null);
  const stale = toBuy.filter(
    (row) =>
      row.cost !== null && now - Date.parse(row.price.date) > 7 * 86400000,
  );
  const subtotal = toBuy.reduce((sum, row) => sum + (row.cost || 0), 0);
  const ready =
    required.length > 0 &&
    positive(recipe.servings) &&
    positive(servings) &&
    !missing.length &&
    !stale.length;
  return {
    ...cost,
    subtotal,
    toBuy,
    shoppingMissing: missing,
    stale,
    ready,
    pantryCount: required.length - toBuy.length,
    additionalIngredients: new Set(
      toBuy.map((row) => row.definition?.key || normalizeName(row.parsed.name)),
    ).size,
  };
}
function buildShoppingList(
  plans,
  recipes,
  index,
  { pantry = [], source = "best", now = Date.now(), measurements = {} } = {},
) {
  const lookup = new Map(recipes.map((recipe) => [recipeKey(recipe), recipe]));
  const items = new Map();
  let unresolvedMeals = 0;
  for (const plan of plans) {
    const originalRecipe = recipeForPlan(plan, lookup);
    const recipe = originalRecipe
      ? withMeasurements(originalRecipe, measurements)
      : null;
    if (!recipe || !positive(recipe.servings) || !recipe.ingredients?.length) {
      unresolvedMeals++;
      continue;
    }
    const cost = assessRecipe(recipe, index, {
      servings: plan.servings,
      source,
      pantry,
      now,
    });
    const scale = plan.servings / Number(recipe.servings);
    for (const row of cost.toBuy) {
      const name = row.definition?.name || row.parsed.name || row.rawName;
      let amount =
        row.conversion.amount === null
          ? row.quantity
          : row.conversion.amount * scale;
      let unit =
        row.conversion.amount === null ? row.parsed.unit : row.definition.unit;
      if (row.conversion.amount === null && amount !== null) {
        if (WEIGHTS[unit]) {
          amount *= WEIGHTS[unit];
          unit = "kg";
        } else if (VOLUMES[unit]) {
          amount *= VOLUMES[unit];
          unit = "l";
        }
      }
      const key = `${row.definition?.key || normalizeName(name)}:${unit || "unspecified"}`;
      const item = items.get(key) || {
        key,
        name,
        unit,
        amount: 0,
        unknownQuantity: false,
        subtotal: 0,
        missing: 0,
        stale: false,
        estimated: false,
        recipes: new Set(),
        raw: new Set(),
        quotes: new Map(),
      };
      if (amount === null) item.unknownQuantity = true;
      else item.amount += amount;
      item.subtotal += row.cost || 0;
      if (row.cost === null) item.missing++;
      item.stale ||=
        row.cost !== null && now - Date.parse(row.price.date) > 7 * 86400000;
      item.estimated ||= row.conversion.estimated;
      item.recipes.add(recipe.name);
      item.raw.add(row.rawName);
      if (row.price)
        item.quotes.set(`${row.price.source}:${row.price.date}`, {
          source: row.price.source,
          date: row.price.date,
        });
      items.set(key, item);
    }
  }
  const rows = [...items.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      ...item,
      recipes: [...item.recipes],
      raw: [...item.raw],
      quotes: [...item.quotes.values()],
      checkKey: `${item.key}:${item.amount.toFixed(6)}:${item.unknownQuantity}`,
    }));
  return {
    items: rows,
    subtotal: rows.reduce((sum, row) => sum + row.subtotal, 0),
    missing: rows.filter((row) => row.missing).length,
    stale: rows.some((row) => row.stale),
    unresolvedMeals,
    complete:
      plans.length > 0 &&
      !unresolvedMeals &&
      !rows.some((row) => row.missing || row.stale),
  };
}
function recipeForPlan(plan, lookup) {
  const current = lookup.get(plan.recipeKey);
  return current?.ingredients?.length && positive(current.servings)
    ? current
    : plan.recipe
      ? { ...current, ...plan.recipe }
      : current;
}
export {
  STORAGE_KEY,
  MEAL_SLOTS,
  recipeKey,
  recipeForPlan,
  validDate,
  cleanKitchen,
  localDate,
  shiftDate,
  weekStart,
  assessRecipe,
  buildShoppingList,
};
const api = {
  STORAGE_KEY,
  MEAL_SLOTS,
  recipeKey,
  recipeForPlan,
  validDate,
  cleanKitchen,
  localDate,
  shiftDate,
  weekStart,
  assessRecipe,
  buildShoppingList,
};
export default api;

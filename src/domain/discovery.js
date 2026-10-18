import {
  normalizeName,
  resolveIngredient,
  hasPhrase,
} from "./ingredientCatalog.js";
import { recipeTraits, preferenceMatch } from "./preferences.js";
import { assessRecipe, recipeKey } from "./planning.js";
import { withMeasurements } from "./measurements.js";
const RECIPE_GROUPS = [
  ["ulam", "All ulam"],
  ["chicken", "Chicken"],
  ["pork", "Pork"],
  ["beef", "Beef"],
  ["seafood", "Fish & seafood"],
  ["vegetables", "Veg & tofu"],
  ["rice-noodles", "Rice & noodles"],
  ["merienda", "Merienda & sweets"],
  ["all", "All recipes"],
];
const sweet =
  /\b(cake|cakes|cookies?|brownies?|muffins?|pancakes?|waffles?|cupcakes?|dessert|pudding|ice cream|halo halo|leche flan|maja blanca|pastillas|polvoron|puto|kutsinta|biko|bibingka|pichi pichi|turon|buchi|palitaw|champorado|smoothie|milkshake|juice|cocktail|lemonade|buko pie|ensaymada|doughnuts?|donuts?|suman|yema|banana bread|ube halaya)\b/;
const metadataCache = new WeakMap();
function discoveryMetadata(recipe) {
  if (metadataCache.has(recipe)) return metadataCache.get(recipe);
  const traits = recipeTraits(recipe);
  const snack =
    sweet.test(normalizeName(recipe.name)) &&
    !traits.proteins.some((x) =>
      ["chicken", "pork", "beef", "seafood"].includes(x),
    );
  const groups = new Set(["all", snack ? "merienda" : "ulam"]);
  if (!snack) {
    for (const protein of traits.proteins)
      if (["chicken", "pork", "beef", "seafood"].includes(protein))
        groups.add(protein);
    if (
      !traits.proteins.some((x) =>
        ["chicken", "pork", "beef", "seafood"].includes(x),
      ) &&
      traits.lines.some(
        (x) =>
          ["Vegetables", "Fruits"].includes(x.definition?.category) ||
          x.proteins.has("tofu") ||
          x.proteins.has("eggs"),
      )
    )
      groups.add("vegetables");
    if (
      /\b(pancit|pansit|noodle|noodles|rice|sinangag|arroz|bihon|sotanghon|spaghetti|pasta|lomi|lugaw|palabok|canton)\b/.test(
        normalizeName(recipe.name),
      )
    )
      groups.add("rice-noodles");
  }
  const label = snack
    ? "Merienda & sweets"
    : groups.has("rice-noodles")
      ? "Rice & noodles"
      : RECIPE_GROUPS.find(
          ([key]) =>
            !["ulam", "all", "merienda", "rice-noodles"].includes(key) &&
            groups.has(key),
        )?.[1] || "Everyday ulam";
  const searchable = normalizeName(
    [
      recipe.name,
      ...traits.lines.flatMap((line) => [
        line.parsed.name,
        line.definition?.name || "",
      ]),
    ].join(" "),
  );
  const title = normalizeName(recipe.name);
  const family =
    [
      ["adobo", /\badobo/],
      ["sinigang", /\bsinigang/],
      ["tinola", /\btinola/],
      ["ginataan", /\bginataan|\bginataang/],
      ["pancit", /\bpancit|\bpansit|\bnoodle|\bpasta|\bspaghetti/],
      ["grilled", /\bgrill|\binihaw|\bbarbecue|\bbbq|\binasal/],
      ["crispy", /\bfried|\bcrispy|\bprito|\bpritong/],
      ["stew", /\bstew|\bcaldereta|\bkaldereta|\bafritada|\bmenudo|\bmechado/],
      ["ginisa", /\bginisa/],
    ].find(([, pattern]) => pattern.test(title))?.[0] ||
    title.replace(/\brecipe\b/g, "").trim();
  const metadata = {
    family,
    ...traits,
    groups,
    label,
    art: snack
      ? "merienda"
      : ["chicken", "pork", "beef", "seafood", "vegetables"].find((x) =>
          groups.has(x),
        ) || "vegetables",
    searchable,
  };
  metadataCache.set(recipe, metadata);
  return metadata;
}
function matchesSearch(recipe, query) {
  const text = normalizeName(query);
  if (!text) return true;
  const metadata = discoveryMetadata(recipe);
  const family = {
    manok: "chicken",
    baboy: "pork",
    baka: "beef",
    isda: "seafood",
  }[text];
  if (family) return metadata.lines.some((line) => line.proteins.has(family));
  if (metadata.searchable.includes(text)) return true;
  const ingredient = resolveIngredient(text);
  if (ingredient?.aliases.includes(text))
    return metadata.lines.some(
      (line) =>
        line.definition && hasPhrase(line.definition.key, ingredient.key),
    );
  return text.split(" ").every((word) => hasPhrase(metadata.searchable, word));
}
function assessDiscovery(
  recipes,
  index,
  {
    profile,
    pantry = [],
    measurements = {},
    source = "best",
    servings = null,
    now = Date.now(),
  },
) {
  return recipes.map((raw) => {
    const recipe = withMeasurements(raw, measurements);
    const metadata = discoveryMetadata(raw);
    const match = preferenceMatch(raw, profile);
    const cost = assessRecipe(recipe, index, {
      source,
      servings: servings || profile.householdSize || recipe.servings,
      pantry,
      now,
    });
    const preferred = metadata.proteins.some((x) =>
      profile.preferredProteins.includes(x),
    );
    return {
      recipe: raw,
      metadata,
      match,
      cost,
      score:
        (profile.mealBudget && cost.ready && cost.subtotal <= profile.mealBudget
          ? 15
          : 0) +
        (metadata.minutes !== null && metadata.minutes <= 45 ? 10 : 0) +
        (metadata.ingredientCount > 0 && metadata.ingredientCount <= 10
          ? 5
          : 0) +
        (preferred ? 30 : 0) +
        Math.min(cost.pantryCount, 6) * 4 +
        (profile.chili === "prefer" && metadata.chili ? 8 : 0),
    };
  });
}
function filterDiscovery(
  entries,
  {
    query = "",
    group = "ulam",
    maxMinutes = null,
    budget = null,
    priced = false,
    saved = false,
    favorites = [],
    usePreferences = false,
    sort = "recommended",
  } = {},
) {
  const favoriteSet = new Set(favorites);
  const sorted = entries
    .filter(
      ({ recipe, metadata, match, cost }) =>
        metadata.groups.has(group) &&
        matchesSearch(recipe, query) &&
        (!usePreferences || match.eligible) &&
        (!maxMinutes ||
          (metadata.minutes !== null && metadata.minutes <= maxMinutes)) &&
        (!budget || (cost.ready && cost.subtotal <= budget)) &&
        (!priced || cost.ready) &&
        (!saved || favoriteSet.has(recipeKey(recipe))),
    )
    .sort((a, b) => {
      if (sort === "time")
        return (
          (a.metadata.minutes ?? Infinity) - (b.metadata.minutes ?? Infinity) ||
          a.recipe.name.localeCompare(b.recipe.name)
        );
      if (sort === "name") return a.recipe.name.localeCompare(b.recipe.name);
      if (sort === "cost")
        return (
          Number(b.cost.ready) - Number(a.cost.ready) ||
          (a.cost.ready ? a.cost.subtotal - b.cost.subtotal : 0) ||
          a.recipe.name.localeCompare(b.recipe.name)
        );
      if (sort === "pantry")
        return (
          b.cost.pantryCount - a.cost.pantryCount ||
          a.cost.additionalIngredients - b.cost.additionalIngredients ||
          a.recipe.name.localeCompare(b.recipe.name)
        );
      return (
        Number(b.cost.ready) - Number(a.cost.ready) ||
        b.score - a.score ||
        Number(favoriteSet.has(recipeKey(b.recipe))) -
          Number(favoriteSet.has(recipeKey(a.recipe))) ||
        b.cost.coverage - a.cost.coverage ||
        a.recipe.name.localeCompare(b.recipe.name)
      );
    });
  if (sort !== "recommended") return sorted;
  // Keep dietary/budget eligibility and ranking tiers; vary dish families within each tier.
  const tiers = new Map();
  for (const entry of sorted) {
    const key = `${entry.cost.ready}:${entry.score}:${favoriteSet.has(recipeKey(entry.recipe))}`;
    if (!tiers.has(key)) tiers.set(key, new Map());
    const families = tiers.get(key);
    if (!families.has(entry.metadata.family))
      families.set(entry.metadata.family, []);
    families.get(entry.metadata.family).push(entry);
  }
  const varied = [];
  for (const families of tiers.values()) {
    const buckets = [...families.values()];
    for (let row = 0; buckets.some((items) => row < items.length); row++)
      for (const items of buckets) if (items[row]) varied.push(items[row]);
  }
  return varied;
}
export {
  RECIPE_GROUPS,
  discoveryMetadata,
  matchesSearch,
  assessDiscovery,
  filterDiscovery,
};
const api = {
  RECIPE_GROUPS,
  discoveryMetadata,
  matchesSearch,
  assessDiscovery,
  filterDiscovery,
};
export default api;

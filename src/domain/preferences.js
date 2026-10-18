import {
  normalizeName,
  resolveIngredient,
  hasPhrase,
} from "./ingredientCatalog.js";
import { parseIngredientText } from "./recipeParser.js";
import { assessRecipe, recipeKey } from "./planning.js";
import { withMeasurements } from "./measurements.js";

import {
  DIETS,
  PROTEINS,
  DEFAULT_PROFILE,
  cleanProfile,
  hasFoodRules,
  hasProfile,
} from "./profile.js";
function parseMinutes(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim().toLowerCase();
  const pattern =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|days?)(?![a-z])/g;
  let result = 0,
    match;
  while ((match = pattern.exec(text)))
    result +=
      Number(match[1]) *
      (/^d/.test(match[2]) ? 1440 : /^h/.test(match[2]) ? 60 : 1);
  // Ranges and additional unparsed text do not establish a reliable total.
  return result > 0 && !text.replace(pattern, "").replace(/[\s,]/g, "")
    ? result
    : null;
}
function recipeMinutes(recipe) {
  if (recipe.total_time) return parseMinutes(recipe.total_time);
  const prep = parseMinutes(recipe.prep_time),
    cook = parseMinutes(recipe.cook_time);
  return prep !== null && cook !== null ? prep + cook : null;
}
const traitCache = new WeakMap();
function recipeTraits(recipe) {
  if (traitCache.has(recipe)) return traitCache.get(recipe);
  const lines = (recipe.ingredients || []).map((raw) => {
    const parsed = parseIngredientText(raw);
    return {
      text: normalizeName(raw),
      parsed,
      definition: resolveIngredient(parsed.name),
    };
  });
  const proteins = new Set();
  let meat = false,
    seafood = false,
    chili = false,
    uncertain = !lines.length;
  for (const line of lines) {
    const { text, parsed, definition } = line;
    const groups = new Set();
    line.proteins = groups;
    const key = definition?.key || "";
    const names = `${text} ${key}`;
    if (
      /\b(chicken|manok|poultry)\b/.test(names) &&
      !/chicken egg/.test(names)
    ) {
      meat = true;
      groups.add("chicken");
    }
    if (
      /\b(pork|baboy|pig|ham|bacon|chorizo|longganisa|sausage|hotdog|lard|chicharon|lechon|luncheon|gelatin)\b/.test(
        names,
      )
    ) {
      meat = true;
      groups.add("pork");
    }
    if (
      /\b(beef|baka|oxtail|tripe|veal|lamb|goat|mutton|duck|turkey)\b/.test(
        names,
      )
    ) {
      meat = true;
      groups.add("beef");
    }
    if (
      definition?.category === "Fish" ||
      /\b(fish|seafood|shrimp|prawn|bagoong|oyster|clam|mussel|crab|squid|patis|anchov|anchovy|dilis|tuna|salmon|sardine|surimi|caviar|scallop)\b/.test(
        names,
      )
    ) {
      seafood = true;
      groups.add("seafood");
    }
    if (/\b(tofu|tokwa|bean|beans|mungbean|lentil|chickpea)\b/.test(names))
      groups.add("tofu");
    if (/\b(egg|eggs|itlog)\b/.test(names)) groups.add("eggs");
    if (
      /\b(chili|chillies|jalapeno|jalapenos|siling|sili|cayenne|sriracha|hot sauce|tabasco|gochujang)\b/.test(
        names,
      )
    )
      chili = true;
    if (key === "liver spread") {
      meat = true;
      groups.add("pork");
    }
    if (
      !/\b(broth|stock|cube|cubes|powder|sauce|paste|seasoning)\b/.test(
        key || normalizeName(parsed.name),
      )
    ) {
      for (const group of groups) proteins.add(group);
    }
    // Unrecognized ingredients must not acquire a dietary certification.
    if (
      !definition &&
      !parsed.isWater &&
      !/^(?:salt|pepper|salt and pepper)(?: to taste)?$/.test(
        normalizeName(parsed.name),
      )
    )
      uncertain = true;
    if (
      [
        "worcestershire sauce",
        "sinigang mix",
        "maggi magic sarap",
        "liquid seasoning",
        "lechon sauce",
      ].includes(key)
    )
      uncertain = true;
  }
  const traits = {
    lines,
    proteins: [...proteins],
    meat,
    seafood,
    chili,
    uncertain,
    minutes: recipeMinutes(recipe),
    ingredientCount: lines.filter((x) => !x.parsed.isWater).length,
  };
  traitCache.set(recipe, traits);
  return traits;
}
function preferenceMatch(recipe, profile) {
  const traits = recipeTraits(recipe),
    conflicts = [];
  if (profile.diet !== "any") {
    if (traits.meat || (profile.diet === "vegetarian" && traits.seafood))
      conflicts.push("Contains ingredients outside your dietary choice");
    else if (traits.uncertain)
      conflicts.push("Some ingredients need a dietary check");
  }
  const avoided = profile.avoid.filter((avoid) => {
    const definition = resolveIngredient(avoid);
    const group = {
      pork: "pork",
      beef: "beef",
      chicken: "chicken",
      fish: "seafood",
      seafood: "seafood",
      baboy: "pork",
      manok: "chicken",
      baka: "beef",
    }[definition?.key || avoid];
    return traits.lines.some(
      (line) =>
        (group && line.proteins.has(group)) ||
        (definition && line.definition?.key === definition.key) ||
        (definition && hasPhrase(line.definition?.key || "", definition.key)) ||
        hasPhrase(line.text, avoid) ||
        (definition &&
          definition.aliases.some((alias) => hasPhrase(line.text, alias))),
    );
  });
  if (avoided.length)
    conflicts.push(
      `Lists ingredients you avoid: ${avoided.map((x) => resolveIngredient(x)?.name || x).join(", ")}`,
    );
  if (profile.chili === "skip" && traits.chili)
    conflicts.push("Lists chili or hot sauce");
  if (
    profile.maxMinutes &&
    (traits.minutes === null || traits.minutes > profile.maxMinutes)
  )
    conflicts.push(
      traits.minutes === null
        ? "Cooking time is not established"
        : `Takes more than ${profile.maxMinutes} minutes`,
    );
  if (profile.maxIngredients && traits.ingredientCount > profile.maxIngredients)
    conflicts.push(`More than ${profile.maxIngredients} listed ingredients`);
  return { eligible: conflicts.length === 0, conflicts, traits };
}
function recommendRecipes(
  recipes,
  index,
  {
    profile,
    pantry = [],
    favorites = [],
    measurements = {},
    now = Date.now(),
    limit = 3,
  } = {},
) {
  const preferences = cleanProfile(profile);
  const favoriteKeys = new Set(favorites);
  const favoriteProteins = new Set(
    recipes
      .filter((r) => favoriteKeys.has(recipeKey(r)))
      .flatMap((r) => recipeTraits(r).proteins),
  );
  return recipes
    .flatMap((raw) => {
      const match = preferenceMatch(raw, preferences);
      if (
        !match.eligible ||
        !raw.ingredients?.length ||
        !(Number(raw.servings) > 0)
      )
        return [];
      const recipe = withMeasurements(raw, measurements);
      const cost = assessRecipe(recipe, index, {
        servings: preferences.householdSize || recipe.servings,
        pantry,
        now,
      });
      const underBudget =
        cost.ready &&
        preferences.mealBudget !== null &&
        cost.subtotal <= preferences.mealBudget;
      if (
        preferences.mealBudget !== null &&
        cost.subtotal > preferences.mealBudget
      )
        return [];
      const preferred = match.traits.proteins.some((p) =>
        preferences.preferredProteins.includes(p),
      );
      const familiar = match.traits.proteins.some((p) =>
        favoriteProteins.has(p),
      );
      const reasons = [];
      if (underBudget) reasons.push("Fits your meal budget");
      if (cost.pantryCount)
        reasons.push(`${cost.pantryCount} from your pantry`);
      if (preferred) reasons.push("A protein you enjoy");
      else if (familiar && !favoriteKeys.has(recipeKey(raw)))
        reasons.push("Similar to your saved meals");
      if (favoriteKeys.has(recipeKey(raw)))
        reasons.push("One of your saved recipes");
      if (preferences.maxMinutes && match.traits.minutes !== null)
        reasons.push(`${match.traits.minutes} minutes`);
      if (preferences.chili === "prefer" && match.traits.chili)
        reasons.push("Lists chili for extra heat");
      if (preferences.diet !== "any")
        reasons.push("Matches your dietary choice");
      if (!reasons.length)
        reasons.push(
          cost.ready ? "Ingredient costs available" : "Explore this recipe",
        );
      const score =
        (preferred ? 30 : 0) +
        (familiar ? 4 : 0) +
        (favoriteKeys.has(recipeKey(raw)) ? 8 : 0) +
        Math.min(cost.pantryCount, 6) * 5 +
        (preferences.chili === "prefer" && match.traits.chili ? 10 : 0);
      return [{ recipe: raw, cost, reasons, score, underBudget }];
    })
    .sort(
      (a, b) =>
        Number(b.underBudget) - Number(a.underBudget) ||
        Number(b.cost.ready) - Number(a.cost.ready) ||
        b.score - a.score ||
        b.cost.coverage - a.cost.coverage ||
        a.recipe.name.localeCompare(b.recipe.name),
    )
    .slice(0, limit);
}
export {
  DIETS,
  PROTEINS,
  DEFAULT_PROFILE,
  cleanProfile,
  hasFoodRules,
  hasProfile,
  parseMinutes,
  recipeMinutes,
  recipeTraits,
  preferenceMatch,
  recommendRecipes,
};
const api = {
  DIETS,
  PROTEINS,
  DEFAULT_PROFILE,
  cleanProfile,
  hasFoodRules,
  hasProfile,
  parseMinutes,
  recipeMinutes,
  recipeTraits,
  preferenceMatch,
  recommendRecipes,
};
export default api;

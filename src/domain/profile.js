import { normalizeName } from "./ingredientCatalog.js";
const DIETS = [
  ["any", "Anything on the menu"],
  ["vegetarian", "Vegetarian · eggs & dairy"],
  ["pescatarian", "Pescatarian · fish, eggs & dairy"],
];
const PROTEINS = [
  ["chicken", "Chicken"],
  ["pork", "Pork"],
  ["beef", "Beef"],
  ["seafood", "Fish & seafood"],
  ["tofu", "Tofu & beans"],
  ["eggs", "Eggs"],
];
const DEFAULT_PROFILE = {
  householdSize: null,
  mealBudget: null,
  diet: "any",
  preferredProteins: [],
  avoid: [],
  chili: "any",
  maxMinutes: null,
  maxIngredients: null,
};
const number = (value, max, integer = false) =>
  ["number", "string"].includes(typeof value) &&
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= max &&
  (!integer || Number.isInteger(Number(value)))
    ? Number(value)
    : null;
function cleanProfile(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    householdSize: number(input.householdSize, 100, true),
    mealBudget: number(input.mealBudget, 1000000),
    diet: DIETS.some(([key]) => input.diet === key) ? input.diet : "any",
    preferredProteins: [
      ...new Set(
        Array.isArray(input.preferredProteins)
          ? input.preferredProteins.filter((key) =>
              PROTEINS.some(([id]) => id === key),
            )
          : [],
      ),
    ],
    avoid: [
      ...new Set(
        (Array.isArray(input.avoid) ? input.avoid : [])
          .filter((x) => typeof x === "string")
          .map((x) => normalizeName(x).slice(0, 80))
          .filter(Boolean),
      ),
    ].slice(0, 20),
    chili: ["any", "skip", "prefer"].includes(input.chili)
      ? input.chili
      : "any",
    maxMinutes: number(input.maxMinutes, 1440, true),
    maxIngredients: number(input.maxIngredients, 50, true),
  };
}
function hasFoodRules(profile) {
  return (
    profile.diet !== "any" ||
    profile.avoid.length > 0 ||
    profile.chili === "skip" ||
    profile.maxMinutes !== null ||
    profile.maxIngredients !== null
  );
}
function hasProfile(profile) {
  return (
    hasFoodRules(profile) ||
    profile.householdSize !== null ||
    profile.mealBudget !== null ||
    profile.preferredProteins.length > 0 ||
    profile.chili === "prefer"
  );
}

export {
  DIETS,
  PROTEINS,
  DEFAULT_PROFILE,
  cleanProfile,
  hasFoodRules,
  hasProfile,
};
const api = {
  DIETS,
  PROTEINS,
  DEFAULT_PROFILE,
  cleanProfile,
  hasFoodRules,
  hasProfile,
};
export default api;

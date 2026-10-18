import preferences from "./preferences.js";
import planning from "./planning.js";
import costing from "./costing.js";
const {
  cleanProfile,
  preferenceMatch,
  recommendRecipes,
  parseMinutes,
  recipeMinutes,
} = preferences;
const date = "2026-10-17",
  now = Date.parse(`${date}T12:00:00Z`);
const recipe = (name, ingredients, total_time = "30 minutes") => ({
  name,
  servings: 2,
  ingredients,
  total_time,
});
const index = costing.createPriceIndex([
  {
    id: "tomato",
    name: "Tomato",
    unit: "KG",
    prices: [{ avg_price: 100, source: "DA Pricewatch", date }],
  },
  {
    id: "chicken",
    name: "Chicken",
    unit: "KG",
    prices: [{ avg_price: 200, source: "SM Supermarkets", date }],
  },
]);
test("old kitchen state gains validated defaults without losing plans, pantry or favorites", () => {
  const old = {
    favorites: ["tomato stew"],
    pantry: ["tomato"],
    plans: [{ recipeKey: "tomato stew", date, slot: "Lunch", servings: 2 }],
  };
  const saved = planning.cleanKitchen(old);
  expect(saved).toMatchObject(old);
  expect(saved.profile).toEqual(preferences.DEFAULT_PROFILE);
  expect(
    cleanProfile({
      householdSize: 3.5,
      mealBudget: Infinity,
      diet: "fake",
      preferredProteins: ["chicken", "bad", "chicken"],
      avoid: [null, "  Mani ", "mani"],
      maxMinutes: -1,
      maxIngredients: 0,
    }),
  ).toMatchObject({
    householdSize: null,
    mealBudget: null,
    diet: "any",
    preferredProteins: ["chicken"],
    avoid: ["mani"],
    maxMinutes: null,
    maxIngredients: null,
  });
  expect(
    cleanProfile({ householdSize: "4", mealBudget: "250.50" }),
  ).toMatchObject({ householdSize: 4, mealBudget: 250.5 });
  expect(cleanProfile({ householdSize: true, mealBudget: [50] })).toMatchObject(
    { householdSize: null, mealBudget: null },
  );
});
test("dietary rules inspect sauces, stocks, processed meats and unclear ingredients", () => {
  const vegetarian = cleanProfile({ diet: "vegetarian" });
  for (const food of [
    "1 tbsp fish sauce",
    "1 cup chicken broth",
    "1 tbsp bagoong",
    "1 tbsp oyster sauce",
    "100 g bacon",
    "100 g liver spread",
    "1 cup mystery sauce",
  ]) {
    expect(
      preferenceMatch(
        recipe("Vegetable dinner", ["1 kg tomato", food]),
        vegetarian,
      ).eligible,
    ).toBe(false);
  }
  expect(
    preferenceMatch(
      recipe("Tomato and egg", [
        "500 g tomato",
        "2 chicken eggs",
        "1 cup water",
        "Salt and pepper to taste",
      ]),
      vegetarian,
    ).eligible,
  ).toBe(true);
  expect(
    preferenceMatch(
      recipe("Fish dinner", ["500 g bangus", "1 kg tomato"]),
      cleanProfile({ diet: "pescatarian" }),
    ).eligible,
  ).toBe(true);
  expect(
    preferenceMatch(
      recipe("Fish dinner", ["500 g bangus", "1 cup pork broth"]),
      cleanProfile({ diet: "pescatarian" }),
    ).eligible,
  ).toBe(false);
});
test("avoided ingredients match aliases, meat families and optional recipe lines", () => {
  for (const [avoid, line] of [
    ["peanut", "1 tbsp peanut butter"],
    ["mani", "1 cup peanuts"],
    ["pork", "100 g bacon"],
    ["fish", "500 g bangus"],
    ["shrimp", "1 tbsp bagoong alamang (optional)"],
    ["tomato", "2 kamatis"],
  ]) {
    expect(
      preferenceMatch(
        recipe("Dinner", [line]),
        cleanProfile({ avoid: [avoid] }),
      ).eligible,
    ).toBe(false);
  }
  expect(
    preferenceMatch(
      recipe("Dinner", ["1 cup coconut milk"]),
      cleanProfile({ avoid: ["coconut cream"] }),
    ).eligible,
  ).toBe(true);
});
test("time and simplicity preferences do not invent missing preparation times", () => {
  expect(parseMinutes("1 hour 15 minutes")).toBe(75);
  expect(parseMinutes("20 mins")).toBe(20);
  expect(parseMinutes("20-30 minutes")).toBe(null);
  expect(parseMinutes("30 minutes plus overnight marinating")).toBe(null);
  expect(
    recipeMinutes({ prep_time: "10 minutes", cook_time: "20 minutes" }),
  ).toBe(30);
  expect(recipeMinutes({ cook_time: "20 minutes" })).toBe(null);
  expect(
    preferenceMatch(
      recipe("Quick", ["1 kg tomato", "1 cup water"], "30 minutes"),
      cleanProfile({ maxMinutes: 30, maxIngredients: 1 }),
    ).eligible,
  ).toBe(true);
  expect(
    preferenceMatch(
      recipe("Unknown", ["1 kg tomato"], "Time varies"),
      cleanProfile({ maxMinutes: 30 }),
    ).eligible,
  ).toBe(false);
});
test("chili choices use explicit ingredients and do not confuse bell peppers or black pepper", () => {
  const noChili = cleanProfile({ chili: "skip" });
  expect(
    preferenceMatch(
      recipe("Dinner", ["1 green bell pepper", "1 tsp black pepper"]),
      noChili,
    ).eligible,
  ).toBe(true);
  expect(
    preferenceMatch(recipe("Dinner", ["1 green chilli"]), noChili).eligible,
  ).toBe(false);
  expect(
    preferenceMatch(recipe("Dinner", ["1 tbsp hot sauce"]), noChili).eligible,
  ).toBe(false);
});
test("recommendations scale household costs and never call partial or stale data a budget fit", () => {
  const recipes = [
    recipe("Tomato stew", ["500 g tomato"]),
    recipe("Incomplete dinner", ["1 kg mystery"]),
    recipe("Costly chicken", ["1 kg chicken"]),
  ];
  const options = {
    profile: { householdSize: 4, mealBudget: 110 },
    now,
    limit: 10,
  };
  const results = recommendRecipes(recipes, index, options);
  expect(results.map((x) => x.recipe.name)).toEqual([
    "Tomato stew",
    "Incomplete dinner",
  ]);
  expect(results[0]).toMatchObject({
    underBudget: true,
    cost: { subtotal: 100, servings: 4 },
  });
  expect(results[0].reasons).toContain("Fits your meal budget");
  expect(results[1].underBudget).toBe(false);
  const stale = recommendRecipes(recipes, index, {
    ...options,
    now: now + 8 * 86400000,
  });
  expect(
    stale.every(
      (x) => !x.underBudget && !x.reasons.includes("Fits your meal budget"),
    ),
  ).toBe(true);
  const pantry = recommendRecipes(recipes, index, {
    ...options,
    pantry: ["chicken"],
  });
  expect(pantry.find((x) => x.recipe.name === "Costly chicken")).toMatchObject({
    cost: { subtotal: 0 },
    underBudget: true,
  });
});
test("preferred proteins, pantry and saved meals rank eligible recipes with clear reasons", () => {
  expect(
    preferences.recipeTraits(
      recipe("Stock", ["1 cup chicken broth", "1 tbsp fish sauce"]),
    ).proteins,
  ).toEqual([]);
  const recipes = [
    recipe("A tomato stew", ["500 g tomato"]),
    recipe("Z chicken dinner", ["500 g chicken"]),
  ];
  expect(
    recommendRecipes(recipes, index, {
      profile: { preferredProteins: ["chicken"] },
      now,
    })[0].recipe.name,
  ).toBe("Z chicken dinner");
  const pantry = recommendRecipes(recipes, index, { pantry: ["chicken"], now });
  expect(pantry[0].recipe.name).toBe("Z chicken dinner");
  expect(pantry[0].reasons).toContain("1 from your pantry");
  expect(
    recommendRecipes(recipes, index, {
      profile: { avoid: ["chicken"] },
      favorites: ["z chicken dinner"],
      now,
    }).map((x) => x.recipe.name),
  ).toEqual(["A tomato stew"]);
  expect(
    recommendRecipes(recipes, index, {
      profile: { avoid: ["chicken", "tomato"] },
      now,
    }),
  ).toEqual([]);
});

import planning from "./planning.js";
import costing from "./costing.js";
import coverage from "./coverage.js";
const { assessRecipe, buildShoppingList, cleanKitchen, weekStart, shiftDate } =
  planning;
const date = "2026-10-17";
const now = Date.parse(`${date}T12:00:00Z`);
const index = costing.createPriceIndex([
  {
    id: "tomato",
    name: "Tomato",
    unit: "KG",
    prices: [{ avg_price: 100, date, source: "DA Pricewatch" }],
  },
]);
const recipe = {
  name: "Tomato stew",
  servings: 2,
  ingredients: ["500 g tomato", "2 cups water", "Salt to taste"],
};
test("budget assessments scale servings, exclude pantry, and reject incomplete or stale budget claims", () => {
  expect(assessRecipe(recipe, index, { servings: 4, now })).toMatchObject({
    subtotal: 100,
    ready: true,
    additionalIngredients: 1,
  });
  expect(
    assessRecipe(
      { ...recipe, ingredients: [...recipe.ingredients, "1 kg chicken"] },
      index,
      { now },
    ),
  ).toMatchObject({ subtotal: 50, ready: false });
  expect(
    assessRecipe(recipe, index, { now: now + 8 * 86400000 }),
  ).toMatchObject({ ready: false });
  expect(
    assessRecipe(recipe, index, {
      now: now + 8 * 86400000,
      pantry: ["tomato"],
    }),
  ).toMatchObject({ subtotal: 0, ready: true, additionalIngredients: 0 });
  expect(
    assessRecipe({ ...recipe, ingredients: [] }, index, { now }),
  ).toMatchObject({ ready: false });
});
test("shopping combines base-unit quantities across recipes and independently scaled servings", () => {
  const another = {
    name: "Tomato soup",
    servings: 4,
    ingredients: ["1 kg tomato"],
  };
  const plans = [
    { recipeKey: "tomato stew", servings: 4 },
    { recipeKey: "tomato soup", servings: 2 },
  ];
  const list = buildShoppingList(plans, [recipe, another], index, { now });
  expect(list).toMatchObject({ subtotal: 150, missing: 0, complete: true });
  expect(list.items).toHaveLength(1);
  expect(list.items[0]).toMatchObject({
    amount: 1.5,
    unit: "kg",
    recipes: ["Tomato stew", "Tomato soup"],
  });
  expect(
    buildShoppingList(plans, [recipe, another], index, {
      now,
      pantry: ["tomato"],
    }),
  ).toMatchObject({ subtotal: 0, items: [], complete: true });
});
test("shopping retains quantities for unavailable quotes, flags unknown amounts and unavailable recipes", () => {
  const unpriced = {
    name: "Chicken dinner",
    servings: 2,
    ingredients: ["500 g chicken", "tomato"],
  };
  const result = buildShoppingList(
    [
      { recipeKey: "chicken dinner", servings: 2 },
      { recipeKey: "removed", servings: 2 },
    ],
    [unpriced],
    index,
    { now },
  );
  expect(result).toMatchObject({
    missing: 2,
    complete: false,
    unresolvedMeals: 1,
  });
  expect(result.items.find((row) => row.name === "Chicken")).toMatchObject({
    amount: 0.5,
    unit: "kg",
    missing: 1,
  });
  expect(result.items.find((row) => row.name === "Tomato")).toMatchObject({
    unknownQuantity: true,
    missing: 1,
  });
});
test("saved state drops corrupt entries, impossible dates, unknown pantry items, and duplicate meal slots", () => {
  const data = cleanKitchen({
    favorites: ["adobo", "adobo", null],
    pantry: ["tomato", "fake"],
    budgets: { "2026-10-19": 1500, bad: 200 },
    plans: [
      null,
      { date: "2026-99-01", slot: "Dinner", recipeKey: "bad", servings: 2 },
      { date: "2026-02-30", slot: "Dinner", recipeKey: "bad", servings: 2 },
      ...["first", "second"].map((key) => ({
        date: "2026-10-19",
        slot: "Dinner",
        recipeKey: key,
        servings: 4,
      })),
    ],
  });
  expect(data.favorites).toEqual(["adobo"]);
  expect(data.pantry).toEqual(["tomato"]);
  expect(data.plans).toEqual([
    { date: "2026-10-19", slot: "Dinner", recipeKey: "second", servings: 4 },
  ]);
  expect(data.budgets).toEqual({ "2026-10-19": 1500 });
  expect(cleanKitchen(null).plans).toEqual([]);
});
test("week navigation crosses month and year boundaries", () => {
  expect(weekStart("2026-10-18")).toBe("2026-10-12");
  expect(shiftDate("2026-12-28", 7)).toBe("2027-01-04");
});
test("cached recipe costs preserve scaling and pantry results without reparsing", () => {
  const baseCost = costing.priceRecipe(recipe, index);
  expect(
    assessRecipe(recipe, index, {
      servings: 5,
      pantry: ["tomato"],
      now,
      baseCost,
    }),
  ).toEqual(
    assessRecipe(recipe, index, { servings: 5, pantry: ["tomato"], now }),
  );
  expect(assessRecipe(recipe, index, { servings: 5, now, baseCost })).toEqual(
    assessRecipe(recipe, index, { servings: 5, now }),
  );
});
test("plans retain imported recipe ingredients when details are not bundled or later unavailable", () => {
  const saved = cleanKitchen({
    plans: [
      {
        date: "2026-10-17",
        slot: "Lunch",
        recipeKey: "tomato stew",
        servings: 4,
        recipe,
      },
    ],
  }).plans;
  expect(buildShoppingList(saved, [], index, { now })).toMatchObject({
    subtotal: 100,
    complete: true,
    unresolvedMeals: 0,
  });
});
test("coverage prioritizes recipes affected and separates price gaps from quantity review", () => {
  const report = coverage.summarizeCoverage(
    [
      recipe,
      {
        name: "One",
        ingredients: ["1 kg chicken", "1 kg chicken", "1 kg mystery food"],
      },
      { name: "Two", ingredients: ["1 kg chicken", "tomato"] },
    ],
    index,
  );
  expect(report.priorities[0]).toMatchObject({
    name: "Chicken",
    status: "no-price",
    recipes: 2,
    rows: 3,
  });
  expect(
    report.priorities.find((row) => row.status === "quantity"),
  ).toMatchObject({ name: "Tomato", recipes: 1 });
});

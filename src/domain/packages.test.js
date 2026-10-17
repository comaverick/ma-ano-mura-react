import packages from "./packages.js";
import costing from "./costing.js";
import measurements from "./measurements.js";
import planning from "./planning.js";
const now = Date.parse("2026-10-17T12:00:00Z");
const offer = (amount, price, extra = {}) => ({
  ingredientKey: "soy sauce",
  unit: "l",
  product: `Soy sauce ${amount}L`,
  sku: String(amount),
  url: "https://smmarkets.ph/soy-sauce.html",
  baseAmount: amount,
  packPrice: price,
  date: "2026-10-17",
  ...extra,
});
const list = (amount = 0.2) => ({
  items: [
    {
      key: "soy sauce:l",
      name: "Soy Sauce",
      unit: "l",
      amount,
      unknownQuantity: false,
    },
  ],
  unresolvedMeals: 0,
  complete: true,
});
test("whole packs round up across the combined amount, choosing total purchase cost over unit-price rank", () => {
  const result = packages.estimatePackages(
    list(),
    [offer(1, 90), offer(0.25, 35)],
    { now },
  );
  expect(result).toMatchObject({ total: 35, complete: true, covered: 1 });
  expect(result.items[0].purchase).toMatchObject({
    packs: 1,
    bought: 0.25,
  });
  expect(result.items[0].purchase.leftover).toBeCloseTo(0.05, 8);
  expect(
    packages.estimatePackages(list(1.2), [offer(0.5, 40)], { now }).items[0]
      .purchase.packs,
  ).toBe(3);
});
test("package totals stay incomplete for stale quotes, missing quantities, wrong units, unknown data and DA-only selection", () => {
  for (const options of [
    { source: "DA Pricewatch" },
    { latestSMDate: "2026-10-18" },
    { now: now + 4 * 86400000 },
  ])
    expect(
      packages.estimatePackages(list(), [offer(1, 90)], { now, ...options }),
    ).toMatchObject({ complete: false, covered: 0 });
  expect(
    packages.estimatePackages(
      { ...list(), items: [{ ...list().items[0], unknownQuantity: true }] },
      [offer(1, 90)],
      { now },
    ).complete,
  ).toBe(false);
  expect(
    packages.validOffer(offer(1, 90, { url: "javascript:alert(1)" })),
  ).toBe(false);
  expect(packages.validOffer(offer(1, 90, { unit: "kg" }))).toBe(false);
  expect(() => packages.cleanSnapshot({ version: 2, offers: [] })).toThrow();
});
test("variable-weight packages use the guaranteed minimum when rounding required packs", () => {
  const result = packages.estimatePackages(
    list(0.6),
    [
      offer(0.5, 40, {
        variable: true,
        estimated: true,
        package: { quantity: 500, maxQuantity: 550, unit: "ml" },
      }),
    ],
    { now },
  );
  expect(result.items[0].purchase).toMatchObject({
    packs: 2,
    total: 80,
    bought: 1,
  });
  expect(result.estimated).toBe(true);
});
test("saved measurements apply only to the original ingredient line, scale with servings, and flow into shopping", () => {
  const recipe = {
    name: "Oil test",
    servings: 2,
    ingredients: ["Oil for frying"],
  };
  const all = measurements.cleanMeasurements({
    "oil test": {
      "ingredient-0": { rawName: "Oil for frying", quantity: 2, unit: "tbsp" },
    },
  });
  const effective = measurements.withMeasurements(recipe, all);
  const index = costing.createPriceIndex([
    {
      id: "oil",
      name: "Vegetable Oil",
      unit: "L",
      prices: [
        { avg_price: 100, date: "2026-10-17", source: "SM Supermarkets" },
      ],
    },
  ]);
  expect(costing.priceRecipe(recipe, index).missing).toHaveLength(1);
  const priced = costing.priceRecipe(effective, index, "best", 4);
  expect(priced.rows[0]).toMatchObject({
    userMeasured: true,
    quantity: 4,
    status: "priced",
  });
  expect(priced.total).toBeCloseTo(5.9147, 3);
  expect(
    planning.buildShoppingList(
      [{ recipeKey: "oil test", servings: 4 }],
      [recipe],
      index,
      { now, measurements: all },
    ).subtotal,
  ).toBeCloseTo(priced.total, 5);
  expect(
    costing.priceRecipe(
      { ...effective, ingredients: ["Oil for brushing"] },
      index,
    ).rows[0].userMeasured,
  ).toBe(false);
  expect(
    measurements.cleanMeasurements({
      x: { "ingredient-0": { quantity: -1, unit: "g", rawName: "x" } },
    }).x,
  ).toEqual({});
});

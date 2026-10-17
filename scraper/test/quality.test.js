const { test } = require("node:test");
const assert = require("node:assert/strict");
const { evaluateQuality } = require("../lib/quality");
const { resolveIngredient } = require("../../src/domain/ingredientCatalog.js");
const { parseIngredientText } = require("../../src/domain/recipeParser.js");
const { matchProduct } = require("../lib/productMatching");
const report = {
  coveragePercent: 78,
  fullyPricedRecipes: 200,
  priorities: [],
  sources: {
    "DA Pricewatch": { ingredients: 50, latest: "2026-10-17" },
    "SM Supermarkets": { ingredients: 100, latest: "2026-10-17" },
  },
};
const input = {
  report,
  prices: [],
  ingredients: [],
  baseline: { coveragePercent: 79 },
  now: new Date("2026-10-17T08:00:00Z"),
};
test("healthy data passes and first-run baseline absence is a warning", () => {
  assert.equal(evaluateQuality(input).passed, true);
  assert.equal(
    evaluateQuality({ ...input, baseline: null }).warnings.length,
    1,
  );
});
test("coverage floors, regressions, missing sources, and stale dates fail visibly", () => {
  assert.equal(
    evaluateQuality({ ...input, report: { ...report, coveragePercent: 69 } })
      .passed,
    false,
  );
  assert.equal(
    evaluateQuality({ ...input, baseline: { coveragePercent: 90 } })
      .coverageChange,
    -12,
  );
  assert.equal(
    evaluateQuality({
      ...input,
      report: {
        ...report,
        sources: { DA: { ingredients: 10, latest: "2026-10-14" } },
      },
    }).passed,
    false,
  );
  assert.equal(
    evaluateQuality({
      ...input,
      report: { ...report, sources: { SM: { ingredients: 0, latest: null } } },
    }).passed,
    false,
  );
});
test("price spikes compare separate observation days for the same ingredient and source", () => {
  const price = (avg, date, source = "DA Pricewatch") => ({
    ingredient_id: "tomato",
    avg_price: avg,
    date,
    source,
  });
  const result = evaluateQuality({
    ...input,
    ingredients: [{ id: "tomato", name: "Tomato" }],
    prices: [
      price(100, "2026-10-16"),
      price(100, "2026-10-16"),
      price(250, "2026-10-17"),
      price(80, "2026-10-17", "SM Supermarkets"),
    ],
  });
  assert.equal(result.passed, false);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].percent, 150);
  assert.equal(result.changes[0].previous, 100);
  assert.equal(
    evaluateQuality({
      ...input,
      prices: [price(100, "2026-10-16"), price(120, "2026-10-17")],
    }).passed,
    true,
  );
});
test("invalid recent prices and future source dates are flagged", () => {
  assert.equal(
    evaluateQuality({
      ...input,
      prices: [{ date: "not-a-date", avg_price: 0 }],
    }).passed,
    false,
  );
  assert.equal(
    evaluateQuality({
      ...input,
      report: {
        ...report,
        sources: { SM: { ingredients: 10, latest: "2026-10-18" } },
      },
    }).passed,
    false,
  );
});
test("old SM quotes absent from its latest collected batch do not create current-change alerts", () => {
  const row = (id, avg, date) => ({
    ingredient_id: id,
    avg_price: avg,
    date,
    source: "SM Supermarkets",
  });
  assert.equal(
    evaluateQuality({
      ...input,
      prices: [
        row("old", 100, "2026-10-15"),
        row("old", 900, "2026-10-16"),
        row("current", 100, "2026-10-17"),
      ],
    }).changes.length,
    0,
  );
});
test("new recipe definitions preserve cut identity and reject unrelated prepared products", () => {
  for (const [name, key] of [
    ["pork chops", "pork chops"],
    ["beef chuck", "beef chuck"],
    ["upo", "bottle gourd"],
    ["vegetable stock", "vegetable broth"],
    ["itlog na maalat", "salted egg"],
    ["corned beef", "corned beef"],
  ])
    assert.equal(resolveIngredient(name)?.key, key);
  assert.equal(
    resolveIngredient("pork chops").key === resolveIngredient("pork belly").key,
    false,
  );
  assert.equal(
    matchProduct({
      name: "Pork Chops 1kg",
      source_category: "Fresh Meat & Seafood",
    })?.key,
    "pork chops",
  );
  for (const name of [
    "Pork Chops Marinated 1kg",
    "Salted Egg Sauce 200g",
    "Vegetable Broth Cubes 100g",
    "Corned Beef Pasta Sauce 200g",
  ])
    assert.equal(matchProduct({ name, source_category: "Pantry" }), null, name);
  assert.equal(parseIngredientText("2 cups tubig water").isWater, true);
});

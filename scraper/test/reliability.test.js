const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  discoverReports,
  parseDailyReport,
  matchDailyReport,
} = require("../lib/daReports");
const { normalizeProductPrice } = require("../lib/priceNormalization");
const { matchProduct } = require("../lib/productMatching");
const { resolveIngredient } = require("../../src/domain/ingredientCatalog.js");
const { makeSnapshot } = require("../lib/marketSnapshot");
test("DA report discovery ignores weekly ranges, future dates, unrelated hosts and stale reports", () => {
  const a = (label, url) => `<a href="${url}">${label}</a>`;
  const html = [
    a(
      "October 17, 2026",
      "https://www.da.gov.ph/wp-content/uploads/2026/10/October-17-2026-DPI-AFC.pdf",
    ),
    a(
      "October 18, 2026",
      "https://www.da.gov.ph/wp-content/uploads/2026/10/October-18-2026-DPI-AFC.pdf",
    ),
    a(
      "October 5-11, 2026",
      "https://www.da.gov.ph/wp-content/uploads/2026/10/Weekly-Average-Prices.pdf",
    ),
    a("October 17, 2026", "https://example.com/Daily-Price-Index.pdf"),
  ].join("");
  const result = discoverReports(html, "2026-10-17");
  assert.equal(result.length, 1);
  assert.equal(result[0].date, "2026-10-17");
});
test("DA PDF parser verifies report identity and date and keeps price and specification columns separate", () => {
  const rows = Array.from(
    { length: 20 },
    (_, i) =>
      `Tomato                 15-18 pcs/kg               ${(100 + i).toFixed(2)}`,
  );
  const text = [
    "Department of Agriculture DAILY PRICE INDEX",
    "National Capital Region (NCR)",
    "Thursday, October 15, 2026",
    ...rows,
    "Chayote               Medium (301-400 g)           69.81",
    "Cooking Oil (Palm)    1 Liter/bottle              101.40",
    "Note(s):",
  ].join("\n");
  const result = parseDailyReport(text, "2026-10-15");
  assert.equal(result.observations.at(-2).avg_price, 69.81);
  assert.equal(result.observations.at(-1).specification, "1 Liter/bottle");
  assert.throws(() => parseDailyReport(text, "2026-10-17"), /date/);
  assert.throws(
    () =>
      parseDailyReport(
        text.replace("National Capital Region (NCR)", "Another region"),
        "2026-10-15",
      ),
    /NCR/,
  );
});
test("DA daily PDF matching avoids fish cuts, medium eggs and misleading bottle-size conversions", () => {
  const ingredients = [
    "Green Chili",
    "Vegetable Oil",
    "Chicken Egg",
    "Salmon",
  ].map((name) => ({
    id: name,
    name,
    unit: name === "Vegetable Oil" ? "L" : "KG",
  }));
  const row = (name, avg_price, specification = "") => ({
    name,
    avg_price,
    specification,
  });
  const result = matchDailyReport(
    [
      row("Chilli (Green), Local", 200.85),
      row("Cooking Oil (Palm)", 40.12, "350 ml/bottle"),
      row("Cooking Oil (Palm)", 101.4, "1 Liter/bottle"),
      row("Chicken Egg (White, Medium)", 8.25),
      row("Salmon Head, Imported", 236.03),
    ],
    ingredients,
    "2026-10-15",
  );
  assert.equal(result.rows.length, 2);
  assert.equal(
    result.rows.find((p) => p.ingredient_id === "Vegetable Oil").avg_price,
    101.4,
  );
});
test("variable packages produce conservative bounded unit estimates and reject inverted ranges", () => {
  const result = normalizeProductPrice(
    { name: "Ground Pork | 500g-550g", price: 147.4 },
    resolveIngredient("ground pork"),
  );
  assert.equal(result.unitPrice, 294.8);
  assert.equal(result.unitPriceLow, 268);
  assert.equal(result.baseAmount, 0.5);
  assert.equal(result.estimated, true);
  assert.match(
    normalizeProductPrice(
      { name: "Ground Pork | 550g-500g", price: 147.4 },
      resolveIngredient("ground pork"),
    ).reason,
    /Invalid/,
  );
});
test("source matching separates chorizo styles, onions, honeydew fruit and herbal drinks", () => {
  const product = (name, source_category = "Fresh Produce") => ({
    name,
    price: 100,
    source_category,
  });
  assert.equal(
    matchProduct(product("SS Onion Red Local | 350g-400g")).key,
    "red onion",
  );
  assert.equal(
    matchProduct(product("SS Onion Spring | 150g-200g")).key,
    "green onion",
  );
  assert.equal(matchProduct(product("SS Onion Leeks | 150g-200g")).key, "leek");
  assert.equal(
    matchProduct(product("Choice Harvest Golden Honey Dew | 1000g-1500g")).key,
    "melon",
  );
  assert.equal(
    matchProduct(
      product("Aldi Turmeric Ginger Lemongrass Tea | 180g", "Beverage"),
    ),
    null,
  );
  assert.equal(
    matchProduct(product("King Sue Macao Chorizo | 220g", "Frozen Goods")).key,
    "chorizo macao",
  );
  assert.equal(
    matchProduct(product("Purefoods Chorizo Bilboa Style | 210g", "Pantry"))
      .key,
    "chorizo de bilbao",
  );
  assert.equal(
    matchProduct(product("Marty's Vegetable Chicharon Plain | 26g", "Pantry")),
    null,
  );
});
test("reviewed anomalies are tied to exact source, date, prior quote and new quote", () => {
  const { evaluateQuality } = require("../lib/quality");
  const report = {
    coveragePercent: 80,
    sources: { "SM Supermarkets": { ingredients: 10, latest: "2026-10-17" } },
  };
  const prices = [
    {
      ingredient_id: "melon",
      source: "SM Supermarkets",
      date: "2026-10-15",
      avg_price: 1800,
    },
    {
      ingredient_id: "melon",
      source: "SM Supermarkets",
      date: "2026-10-17",
      avg_price: 222,
    },
  ];
  const input = {
    report,
    prices,
    ingredients: [{ id: "melon", name: "Melon" }],
    now: new Date("2026-10-17T12:00:00Z"),
  };
  assert.equal(evaluateQuality(input).passed, true);
  assert.equal(
    evaluateQuality({
      ...input,
      prices: [prices[0], { ...prices[1], avg_price: 221 }],
    }).passed,
    false,
  );
  assert.equal(evaluateQuality({ ...input, reviews: [] }).passed, false);
});
test("public package snapshots only include quotes actually persisted for the current observation date", () => {
  const ingredients = [{ id: "soy", name: "Soy Sauce", unit: "L" }];
  const products = [
    {
      name: "Soy Sauce | 1L",
      price: 90,
      url: "https://smmarkets.ph/soy.html",
      source_category: "Pantry",
      observed_at: "2026-10-17T10:00:00Z",
    },
  ];
  const args = {
    ingredients,
    products,
    prices: [],
    now: new Date("2026-10-17T12:00:00Z"),
  };
  assert.equal(makeSnapshot(args).offers.length, 0);
  assert.equal(
    makeSnapshot({
      ...args,
      prices: [
        {
          ingredient_id: "soy",
          avg_price: 90,
          date: "2026-10-17",
          source: "SM Supermarkets",
        },
      ],
    }).offers.length,
    1,
  );
  assert.equal(
    makeSnapshot({
      ...args,
      prices: [
        {
          ingredient_id: "soy",
          avg_price: 100,
          date: "2026-10-17",
          source: "SM Supermarkets",
        },
      ],
    }).offers.length,
    0,
  );
});
test("DA and SM can retain same-day prices under the existing location/date uniqueness rule", () => {
  const { LOCATION_ID, SM_LOCATION_ID } = require("../lib/persistence");
  assert.notEqual(LOCATION_ID, SM_LOCATION_ID);
  const { prepareSMPrices } = require("../lib/smPipeline");
  const result = prepareSMPrices(
    [
      {
        name: "Soy Sauce | 1L",
        price: 90,
        url: "https://smmarkets.ph/soy.html",
        source_category: "Pantry",
        observed_at: "2026-10-17T10:00:00Z",
      },
    ],
    [{ id: "soy", name: "Soy Sauce", unit: "L" }],
    { date: "2026-10-17" },
  );
  assert.equal(result.rows[0].location_id, SM_LOCATION_ID);
});

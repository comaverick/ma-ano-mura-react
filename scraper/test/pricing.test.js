const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveIngredient,
  catalog,
  catalogForMarket,
} = require("../../src/domain/ingredientCatalog.js");
const {
  parseIngredientText,
  parseQuantity,
} = require("../../src/domain/recipeParser.js");
const {
  convertQuantity,
  getLatestPrice,
  priceRecipe,
  createPriceIndex,
} = require("../../src/domain/costing.js");
const { matchProduct } = require("../lib/productMatching");
const {
  parsePackage,
  normalizeProductPrice,
} = require("../lib/priceNormalization");
const { parseMarketNumber, parseDATable } = require("../index");
const { prepareSMPrices } = require("../lib/smPipeline");
const { manilaDate } = require("../lib/persistence");
const def = (name) => resolveIngredient(name);
const product = (name, category = "Pantry") => ({
  name,
  source_category: category,
  price: 100,
});
test("recipe quantities preserve fractions, Unicode, ranges, and package sizes", () => {
  assert.equal(parseQuantity("1 1/2"), 1.5);
  assert.equal(parseQuantity("1½"), 1.5);
  assert.equal(parseQuantity("1/0"), null);
  for (const [text, q, u] of [
    ["1/4 teaspoon salt", 0.25, "tsp"],
    ["1 1/2 cups mung beans", 1.5, "cup"],
    ["½ lb ground pork", 0.5, "lb"],
    ["1 8 oz. can tomato sauce", 8, "oz"],
    ["2 packs Sinigang Mix (20 gram pack)", 40, "g"],
    ["2 to 3 cloves garlic", 2.5, "clove"],
    ["1 (3 to 4 pounds) whole chicken, cut into parts", 3.5, "lb"],
    ["4 (300 grams each) chayotes", 1200, "g"],
  ]) {
    const parsed = parseIngredientText(text);
    assert.equal(parsed.quantity, q, text);
    assert.equal(parsed.unit, u, text);
  }
  assert.equal(
    parseIngredientText("1 tablespoon crushed black pepper").name,
    "black pepper",
  );
  assert.equal(
    parseIngredientText("1/2 cup chopped green onions").name,
    "green onions",
  );
  assert.equal(
    parseIngredientText("Fish sauce and ground black pepper to taste").toTaste,
    true,
  );
  assert.equal(parseIngredientText("2 cups hot water").isWater, true);
});
test("Filipino and market aliases share physical ingredients without crossing food types", () => {
  assert.equal(def("string beans").key, "sitao");
  assert.notEqual(def("string beans").key, def("green beans").key);
  assert.equal(def("dahon ng laurel").key, "laurel leaves");
  assert.equal(def("bawang").key, "garlic");
  assert.equal(catalogForMarket({ name: "Squash" }).key, "kalabasa");
  assert.notEqual(def("coconut cream").key, def("coconut milk").key);
  assert.equal(def("ground pork").key, "ground pork");
  assert.equal(def("pork hock").key, "pork hock");
  assert.equal(def("pork intestines"), null);
  assert.equal(def("quail eggs"), null);
  assert.equal(def("corned beef"), null);
});
test("SM matches exact food identities and reversed product words", () => {
  for (const [name, key] of [
    ["Knorr Cubes Chicken | 60g", "chicken cubes"],
    ["SM Bonus Powder Garlic | 50g", "garlic powder"],
    ["SM BONUS COCONUT CREAM 400ML", "coconut cream"],
    ["UFC Banana Catsup | 550g", "banana ketchup"],
    ["Mama Sita Sinigang Sa Sampalok Mix | 50g", "sinigang mix"],
    ["SM BONUS BAGOONG REGULAR 250G", "shrimp paste"],
  ])
    assert.equal(matchProduct(product(name))?.key, key, name);
  assert.equal(
    matchProduct(product("SM Bonus Tomato | 500g", "Fresh Produce"))?.key,
    "tomato",
  );
  assert.equal(
    matchProduct(product("Maestro Chicken Breast Fillet | 1kg", "Frozen Goods"))
      ?.key,
    "chicken breast",
  );
});
test("recipe ingredients never take prices from unrelated prepared food or pet products", () => {
  const negatives = [
    ["San Marino Tuna Fillet Spanish Style | 180g", "Frozen Goods", "tuna"],
    ["Century Tuna Steak In Olive Oil | 180g", "Frozen Goods", "tuna"],
    ["San Marino Tuna Paella | 180g", "Frozen Goods", "tuna"],
    ["CDO Young Pork Baconetttes Thick Cut | 200g", "Frozen Goods", "pork"],
    ["Sip Plus Honey Yuzu | 500ml", "Beverage", "honey"],
    [
      "Coles Whole Meal Self Raising Flour | 1kg",
      "Pantry",
      "all purpose flour",
    ],
    ["SM Bonus Tuna Afritada | 155g", "Frozen Goods", "tuna"],
    [
      "Purefoods Chicken Breast Nuggets | 1kg",
      "Frozen Goods",
      "chicken breast",
    ],
    ["CDO Beef Franks Regular | 1kg", "Frozen Goods", "beef"],
    ["Ore Ida Onion Ringers | 255g", "Frozen Goods", "white onion"],
    ["Johsonville Garlic Bratwurts | 360g", "Frozen Goods", "garlic"],
    ["Oceans Harvest Salmon Sinigang Mix 1kg", "Frozen Goods", "sinigang mix"],
    [
      "Pedigree Chicken & Vegetable Dogfood | 10kg",
      "Search: Chicken",
      "chicken",
    ],
    ["Margies Hopia Onion | 200g", "Bakery", "white onion"],
    ["Milk Magic Powder Milk | 500g", "Pantry", "milk"],
    ["SM Bonus Quail Eggs | 24pcs", "Chilled & Dairy Items", "chicken egg"],
    ["Arawan Finest Rice Flour | 500g", "Pantry", "all purpose flour"],
    ["SM Bonus Marshmallows Mango | 200g", "Pantry", "mango"],
    ["Molinera Black Olives | 300g", "Pantry", "green olive"],
    ["McCormick Salad Shots Cilantro Lime | 15g", "Pantry", "cilantro"],
    ["Samyang Fire Chicken Habanero Lime | 140g", "Pantry", "lime"],
    ["Amoy Ginger With Shallot Oil | 200g", "Pantry", "shallot"],
    ["SM Bonus Powder Celery | 50g", "Pantry", "celery"],
    [
      "Kawaii Max Kojic Green Papaya | 135g",
      "Search: Green Papaya",
      "green papaya",
    ],
    ["Knorr Sinigang Na May Gabi | 44g", "Pantry", "taro"],
    ["Payless Pancit Canton Kalamansi | 125g", "Pantry", "calamansi"],
    ["Fat & Thin Potato Starch | 500g", "Frozen Goods", "white potato"],
    ["Tiffany Hotdog Roll | 400g", "Bakery", "hotdog"],
    ["Quaker Oats Banana & Honey | 500g", "Pantry", "honey"],
    [
      "Presto Creams Peanut Butter Jelly Grape | 33g 10pcs",
      "Pantry",
      "peanut butter",
    ],
  ];
  for (const [name, category, key] of negatives)
    assert.notEqual(matchProduct(product(name, category))?.key, key, name);
});
test("package normalization uses the declared unit and handles multipacks once", () => {
  assert.equal(parsePackage("Oil | 1/2 gallon").quantity, 3.785411784 / 2);
  assert.equal(
    normalizeProductPrice({ name: "Flour | 1kg", price: 100 }, def("flour"))
      .unitPrice,
    100,
  );
  assert.equal(
    normalizeProductPrice(
      { name: "Soy sauce | 500ml", price: 50 },
      def("soy sauce"),
    ).unitPrice,
    100,
  );
  assert.equal(
    normalizeProductPrice({ name: "Eggs | 30pcs", price: 300 }, def("egg"))
      .unitPrice,
    10,
  );
  assert.equal(parsePackage("Mix | 8g x 16").quantity, 128);
  assert.equal(parsePackage("Wrapper | 1kg 60pcs").quantity, 1);
  assert.equal(
    parsePackage("Fish | 400g-500g").reason,
    "Variable package weight",
  );
  assert.ok(
    normalizeProductPrice({ name: "Lemon | 3pcs", price: 80 }, def("lemon"))
      .reason,
  );
  assert.ok(
    normalizeProductPrice(
      { name: "Beef Broth | 1kg", price: 150 },
      def("beef broth"),
    ).reason,
  );
  const sauce = normalizeProductPrice(
    { name: "Banana catsup | 1kg", price: 100 },
    def("banana ketchup"),
  );
  assert.equal(sauce.unitPrice, 110);
  assert.equal(sauce.estimated, true);
});
test("DA table ignores unavailable values, parses thousands, and averages valid markets only", () => {
  assert.equal(parseMarketNumber("₱1,234.50"), 1234.5);
  assert.equal(parseMarketNumber("N/A"), null);
  assert.equal(parseMarketNumber("-"), null);
  assert.equal(parseMarketNumber("100-120"), null);
  const rows = parseDATable(
    "<tr><th>Commodity</th></tr><tr><td>Garlic(Imported)</td><td>KG</td><td>1,200.00</td><td>N/A</td><td>1,000.00</td><td>—</td></tr><tr><td>Tomato</td><td>KG</td><td>N/A</td></tr>",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].avg_price, 1100);
  assert.equal(rows[0].markets, 2);
});
test("lowest available compares each source latest quote and rejects zero or stale outliers", () => {
  const prices = [
    { id: "a", avg_price: 10, date: "2026-10-01", source: "DA Pricewatch" },
    { id: "b", avg_price: 100, date: "2026-10-16", source: "DA Pricewatch" },
    { id: "c", avg_price: 80, date: "2026-10-15", source: "SM Supermarkets" },
    { id: "d", avg_price: 0, date: "2026-10-16", source: "SM Supermarkets" },
  ];
  assert.equal(getLatestPrice({ prices }).avg_price, 80);
  assert.equal(getLatestPrice({ prices }, "DA Pricewatch").avg_price, 100);
  assert.equal(
    getLatestPrice({ prices: [prices[0], prices[1]] }).avg_price,
    100,
  );
  assert.equal(
    getLatestPrice({ prices: [{ avg_price: null, date: "2026-10-16" }] }),
    null,
  );
});
test("costs handle mass, volume, cup weights, and average pieces explicitly", () => {
  assert.equal(convertQuantity(500, "g", def("pork")).amount, 0.5);
  assert.equal(convertQuantity(1, "lb", def("pork")).amount, 0.45359237);
  assert.ok(
    Math.abs(convertQuantity(1, "cup", def("flour")).amount - 0.125) < 1e-9,
  );
  assert.equal(convertQuantity(3, "clove", def("garlic")).amount, 0.009);
  assert.equal(convertQuantity(3, "clove", def("garlic")).estimated, true);
  assert.equal(convertQuantity(1, "can", def("tomato sauce")).amount, null);
  assert.equal(convertQuantity(null, "kg", def("pork")).amount, null);
});
test("recipe coverage keeps missing prices and unknown amounts out of the total and scales servings", () => {
  const ingredients = [
    {
      id: "1",
      name: "Tomato",
      unit: "KG",
      prices: [
        {
          id: "p1",
          avg_price: 100,
          date: "2026-10-16",
          source: "DA Pricewatch",
        },
      ],
    },
  ];
  const recipe = {
    servings: 2,
    ingredients: [
      "500 g tomato",
      "2 cups water",
      "Salt and pepper to taste",
      "2 pieces green onion",
      "1 can coconut milk",
    ],
  };
  const cost = priceRecipe(recipe, createPriceIndex(ingredients), "best", 4);
  assert.equal(cost.total, 100);
  assert.equal(cost.requiredCount, 3);
  assert.equal(cost.pricedCount, 1);
  assert.equal(cost.missing.length, 2);
  assert.equal(cost.rows[0].quantity, 1000);
  assert.equal(cost.rows[1].status, "water");
  assert.equal(cost.rows[2].status, "to-taste");
});
test("old SM files cannot become new daily prices", () => {
  const ingredients = [{ id: "soy", name: "Soy Sauce", unit: "L" }];
  const old = prepareSMPrices(
    [{ name: "Soy Sauce | 1L", price: 80, source_category: "Pantry" }],
    ingredients,
    { date: "2026-10-16" },
  );
  assert.equal(old.rows.length, 0);
  assert.match(old.report.rejected[0].reason, /observation/);
  const current = prepareSMPrices(
    [
      {
        name: "Soy Sauce | 1L",
        price: 80,
        source_category: "Pantry",
        observed_at: "2026-10-15T16:05:00Z",
      },
    ],
    ingredients,
    { date: "2026-10-16" },
  );
  assert.equal(current.rows.length, 1);
  assert.equal(current.rows[0].date, "2026-10-16");
  assert.equal(manilaDate(new Date("2026-10-15T16:05:00Z")), "2026-10-16");
});
test("catalog keys are unique and numeric conversion metadata is positive", () => {
  assert.equal(new Set(catalog.map((item) => item.key)).size, catalog.length);
  for (const item of catalog)
    for (const key of ["cupGrams", "pieceGrams", "density"])
      if (item[key] !== null) assert.ok(item[key] > 0, `${item.name}: ${key}`);
});

test("a lost insert response is reconciled before retrying and reruns stay idempotent", async () => {
  const { writePrices, LOCATION_ID } = require("../lib/persistence");
  const saved = [];
  let insertCalls = 0;
  let loseResponse = true;
  const client = {
    from: () => {
      const filters = [];
      const query = {
        select: () => query,
        eq: (key, value) => {
          filters.push((row) => row[key] === value);
          return query;
        },
        in: (key, values) => {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        then: (resolve, reject) =>
          Promise.resolve({
            data: saved.filter((row) => filters.every((filter) => filter(row))),
            error: null,
          }).then(resolve, reject),
        insert: (rows) => ({
          throwOnError: async () => {
            insertCalls++;
            saved.push(...rows.map((row, i) => ({ ...row, id: "saved-" + i })));
            if (loseResponse) {
              loseResponse = false;
              throw new Error("Response lost after server commit");
            }
            return { error: null };
          },
        }),
        update: () => ({
          in: () => ({ throwOnError: async () => ({ error: null }) }),
        }),
      };
      return query;
    },
  };
  const rows = [
    {
      ingredient_id: "soy",
      location_id: LOCATION_ID,
      avg_price: 80,
      date: "2026-10-16",
      source: "SM Supermarkets",
    },
  ];
  await writePrices(client, rows);
  await writePrices(client, rows);
  assert.equal(saved.length, 1);
  assert.equal(insertCalls, 1);
  await assert.rejects(
    () => writePrices(client, [...rows, ...rows]),
    /Duplicate ingredient/,
  );
  await assert.rejects(
    () => writePrices(client, [{ ...rows[0], avg_price: 0 }], { dryRun: true }),
    /validation/,
  );
});

test("SM ingredients absent from the latest catalog are not carried forward as current quotes", () => {
  const index = createPriceIndex([
    {
      id: "t",
      name: "Tomato",
      unit: "KG",
      prices: [
        { avg_price: 80, date: "2026-10-15", source: "SM Supermarkets" },
        { avg_price: 100, date: "2026-10-16", source: "DA Pricewatch" },
      ],
    },
    {
      id: "s",
      name: "Salt",
      unit: "KG",
      prices: [
        { avg_price: 20, date: "2026-10-16", source: "SM Supermarkets" },
      ],
    },
  ]);
  assert.equal(getLatestPrice(index.get("tomato"), "SM Supermarkets"), null);
  assert.equal(getLatestPrice(index.get("tomato")).avg_price, 100);
  assert.equal(index.get("tomato").prices.length, 2);
});

test("generic meat can use an explicit market-cut reference while specific cuts remain distinct", () => {
  const index = createPriceIndex([
    {
      id: "kasim",
      name: "Pork Ham (Kasim)",
      unit: "KG",
      prices: [{ avg_price: 300, date: "2026-10-16", source: "DA Pricewatch" }],
    },
  ]);
  const cost = priceRecipe(
    { ingredients: ["500 g pork", "500 g pork hock"] },
    index,
  );
  assert.equal(cost.total, 150);
  assert.equal(cost.rows[0].price.reference, true);
  assert.match(cost.rows[0].conversion.reason, /Kasim/);
  assert.equal(cost.rows[1].cost, null);
  assert.equal(resolveIngredient("beef sirloin"), null);
});

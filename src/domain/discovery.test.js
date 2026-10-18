import discovery from "./discovery.js";
import costing from "./costing.js";
import preferences from "./preferences.js";
const { discoveryMetadata, matchesSearch, assessDiscovery, filterDiscovery } =
  discovery;
const now = Date.parse("2026-10-18T12:00:00Z"),
  date = "2026-10-18";
const recipe = (name, ingredients, total_time = "30 minutes") => ({
  id: name,
  name,
  ingredients,
  total_time,
  servings: 2,
});
const recipes = [
  recipe("Chicken Adobo", ["500 g chicken", "250 g tomato"]),
  recipe("Tomato egg stew", ["500 g tomato", "2 chicken eggs"]),
  recipe("Mystery dinner", ["1 kg mystery ingredient"]),
  recipe("Chocolate Cake", ["1 cup all purpose flour", "2 chicken eggs"]),
  recipe("Tomato soup", ["500 g tomato"], "10 minutes"),
];
const index = costing.createPriceIndex([
  {
    id: "chicken",
    name: "Chicken",
    unit: "KG",
    prices: [{ date, source: "SM Supermarkets", avg_price: 200 }],
  },
  {
    id: "tomato",
    name: "Tomato",
    unit: "KG",
    prices: [{ date, source: "DA Pricewatch", avg_price: 100 }],
  },
]);
const assess = (options = {}) =>
  assessDiscovery(recipes, index, {
    profile: preferences.cleanProfile({}),
    now,
    ...options,
  });
test("ulam discovery separates sweets and keeps savory fish cakes and rice dishes discoverable", () => {
  expect(discoveryMetadata(recipes[3]).groups.has("merienda")).toBe(true);
  expect(filterDiscovery(assess()).map((x) => x.recipe.name)).not.toContain(
    "Chocolate Cake",
  );
  expect(filterDiscovery(assess(), { group: "all" })).toHaveLength(5);
  expect(
    discoveryMetadata(recipe("Fish Cake", ["500 g bangus"])).groups.has(
      "seafood",
    ),
  ).toBe(true);
  expect(
    discoveryMetadata(
      recipe("Chicken fried rice", ["500 g chicken", "1 cup rice"]),
    ).groups.has("rice-noodles"),
  ).toBe(true);
  expect(
    discoveryMetadata(
      recipe("Vegetable stew", ["1 kg tomato", "1 cup chicken broth"]),
    ).groups.has("chicken"),
  ).toBe(false);
});
test("search finds actual recipe ingredients and Filipino aliases without broadening a full dish query", () => {
  expect(matchesSearch(recipes[0], "kamatis")).toBe(true);
  expect(matchesSearch(recipes[0], "manok")).toBe(true);
  expect(matchesSearch(recipes[0], "tomato chicken")).toBe(true);
  expect(
    matchesSearch(recipe("Chicken soup", ["500 g chicken"]), "chicken adobo"),
  ).toBe(false);
  expect(matchesSearch(recipes[0], "hipon")).toBe(false);
});
test("budget filtering scales portions, removes pantry costs, and excludes incomplete or stale quotes", () => {
  expect(
    filterDiscovery(
      assess({ profile: preferences.cleanProfile({ mealBudget: 60 }) }),
    )[0].recipe.name,
  ).toBe("Tomato soup");
  const scaled = assess({ servings: 4 });
  expect(
    filterDiscovery(scaled, { budget: 150 }).map((x) => x.recipe.name),
  ).toEqual(["Tomato soup"]);
  expect(
    filterDiscovery(assess({ servings: 4, pantry: ["chicken", "tomato"] }), {
      budget: 1,
    }).map((x) => x.recipe.name),
  ).toContain("Chicken Adobo");
  expect(
    filterDiscovery(assess({ now: now + 8 * 86400000 }), { budget: 1000 }),
  ).toEqual([]);
  expect(
    filterDiscovery(assess(), { priced: true }).map((x) => x.recipe.name),
  ).toEqual(["Chicken Adobo", "Tomato soup"]);
});
test("time limits, saved recipes and dietary exclusions apply together", () => {
  const entries = assess({
    profile: preferences.cleanProfile({ avoid: ["chicken"] }),
  });
  expect(
    filterDiscovery(entries, { usePreferences: true }).some(
      (x) => x.recipe.name === "Chicken Adobo",
    ),
  ).toBe(false);
  expect(
    filterDiscovery(entries, {
      saved: true,
      favorites: ["chicken adobo"],
      usePreferences: true,
    }),
  ).toEqual([]);
  expect(
    filterDiscovery(entries, { saved: true, favorites: ["chicken adobo"] }).map(
      (x) => x.recipe.name,
    ),
  ).toEqual(["Chicken Adobo"]);
  expect(
    filterDiscovery(entries, { maxMinutes: 15 }).map((x) => x.recipe.name),
  ).toEqual(["Tomato soup"]);
  expect(
    filterDiscovery(
      [
        ...entries,
        ...assessDiscovery(
          [recipe("Unknown time", ["1 kg tomato"], "varies")],
          index,
          { profile: preferences.cleanProfile({}), now },
        ),
      ],
      { maxMinutes: 30 },
    ).some((x) => x.recipe.name === "Unknown time"),
  ).toBe(false);
});
test("lowest-cost sorting ranks complete shopping estimates before tempting partial subtotals", () => {
  const sorted = filterDiscovery(assess(), { sort: "cost" });
  expect(sorted[0].recipe.name).toBe("Tomato soup");
  expect(sorted[1].recipe.name).toBe("Chicken Adobo");
  expect(sorted.slice(2).every((x) => !x.cost.ready)).toBe(true);
  expect(filterDiscovery(assess(), { sort: "time" })[0].recipe.name).toBe(
    "Tomato soup",
  );
});
test("cut meat stays in its protein group while bouillon cubes remain a seasoning", () => {
  const diced = discoveryMetadata(
    recipe("Pork and beans", [
      "700 grams pork belly cut into 1/2-inch cubes",
      "1 cup sitaw",
    ]),
  );
  expect(diced.groups.has("pork")).toBe(true);
  expect(diced.groups.has("vegetables")).toBe(false);
  expect(
    discoveryMetadata(
      recipe("Vegetable stock soup", ["1 chicken cube", "1 kg tomato"]),
    ).groups.has("chicken"),
  ).toBe(false);
});
test("recommended discovery varies dish families instead of filling the first row with adobo variants", () => {
  const candidates = [
    recipe("Adobo A", ["500 g chicken"]),
    recipe("Adobo B", ["500 g chicken"]),
    recipe("Adobo C", ["500 g chicken"]),
    recipe("Chicken Tinola", ["500 g chicken"]),
    recipe("Chicken Sinigang", ["500 g chicken"]),
  ];
  const entries = assessDiscovery(candidates, index, {
    profile: preferences.cleanProfile({}),
    now,
  });
  const results = filterDiscovery(entries);
  expect(new Set(results.slice(0, 3).map((x) => x.metadata.family)).size).toBe(
    3,
  );
  expect(results.every((x) => x.cost.ready)).toBe(true);
});

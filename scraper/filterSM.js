const fs = require("fs");

const products = JSON.parse(
  fs.readFileSync("scraper/sm-products.json", "utf8")
);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  These are the actual ingredient/product types
  we want to keep for Ma-Ano-Mura.
*/
const rules = [
  // Sauces / seasonings
  ["coconut milk", ["coconut milk", "gata"]],
  ["coconut cream", ["coconut cream", "kakang gata"]],
  ["bagoong", ["bagoong"]],
  ["soy sauce", ["soy sauce"]],
  ["vinegar", ["vinegar"]],
  ["fish sauce", ["fish sauce"]],
  ["patis", ["patis"]],
  ["oyster sauce", ["oyster sauce"]],
  ["shrimp paste", ["shrimp paste", "alamang"]],
  ["liver spread", ["liver spread"]],

  // Cooking basics
  ["cooking oil", ["cooking oil", "canola oil", "palm oil", "olive oil"]],
  ["sugar", ["sugar"]],
  ["salt", ["salt"]],
  ["black pepper", ["black pepper"]],
  ["garlic", ["garlic"]],
  ["ginger", ["ginger"]],
  ["onion", ["onion"]],
  ["tomato sauce", ["tomato sauce"]],
  ["tomato paste", ["tomato paste"]],

  // Vegetables / pantry ingredients
  ["potato", ["potato"]],
  ["carrot", ["carrot"]],
  ["corn", ["whole corn", "corn kernels", "cornstarch"]],
  ["mushroom", ["mushroom"]],
  ["mung bean", ["mungbean", "mung bean", "mongo"]],

  // Filipino cooking mixes
  ["sinigang", ["sinigang"]],
  ["sampalok", ["sampalok"]],
  ["magic sarap", ["magic sarap"]],
  ["chicken cubes", ["chicken cubes"]],
  ["pork cubes", ["pork cubes"]],
  ["beef cubes", ["beef cubes"]],

  // Dry ingredients
  ["flour", ["all purpose flour"]],
  ["cornstarch", ["cornstarch"]],
  ["bihon", ["bihon"]],
  ["vermicelli", ["vermicelli", "sotanghon"]],

  // Spices / herbs
  ["bay leaf", ["laurel leaves", "bay leaf"]],
  ["chili", ["chili powder", "chili pepper"]],

  // Other useful pantry ingredients
  ["rice", ["rice"]],
  ["spaghetti", ["spaghetti"]],
  ["cream", ["all purpose cream"]],
  ["evaporated milk", ["evaporated milk"]],
  ["condensed milk", ["condensed milk"]],
];

/*
  Products we definitely DON'T want,
  even if they contain a keyword above.
*/
const exclude = [
  "corned beef",
  "corned tuna",
  "corned",
  "sardines",
  "instant noodle",
  "instant mami",
  "pancit canton",
  "ramen",
  "noodle",
  "cereal",
  "peanut butter",
  "margarine",
  "mayonnaise",
  "mayo",
  "chocolate",
  "candy",
  "biscuit",
  "cracker",
  "chips",
  "snack",
  "protein bar",
  "spaghetti sauce",
  "pasta sauce",
  "ketchup",
  "barbecue sauce",
  "sweet chili sauce",
  "chili sauce",
  "sriracha",
  "soup",
  "cream of mushroom",
  "mushroom soup",
  "fried rice mix",
  "rice mix",
  "curry noodle",
];

function findCategory(name) {
  for (const [category, keywords] of rules) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

const filtered = [];

for (const product of products) {
  const name = normalize(product.name);

  // Remove obvious non-ingredient products
  const isExcluded = exclude.some(word =>
    name.includes(word)
  );

  if (isExcluded) {
    continue;
  }

  const category = findCategory(name);

  if (!category) {
    continue;
  }

  filtered.push({
    ...product,
    ingredient_category: category,
  });
}

console.log(`RAW PRODUCTS: ${products.length}`);
console.log(`FILTERED PRODUCTS: ${filtered.length}`);
console.log(`REMOVED: ${products.length - filtered.length}`);

console.log("\nCATEGORY COUNTS:");

const counts = {};

for (const product of filtered) {
  counts[product.ingredient_category] =
    (counts[product.ingredient_category] || 0) + 1;
}

Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`${category}: ${count}`);
  });

fs.writeFileSync(
  "scraper/sm-food-products.json",
  JSON.stringify(filtered, null, 2)
);

console.log("\nSaved:");
console.log("scraper/sm-food-products.json");
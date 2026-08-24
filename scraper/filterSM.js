const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "sm-products.json");
const outputPath = path.join(__dirname, "sm-food-products.json");

const products = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const supportedCategories = new Set([
  "Fresh Produce",
  "Fresh Meat & Seafood",
  "Frozen Goods",
  "Ready to Cook",
  "Chilled & Dairy Items",
  "Bakery",
  "International Goods",
  "Pantry",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const excludedTerms = [
  "dog food",
  "cat food",
  "pet food",
  "shampoo",
  "conditioner",
  "toothpaste",
  "toothbrush",
  "soap",
  "sanitary",
  "diaper",
  "deodorant",
  "lotion",
  "cosmetic",
  "makeup",
  "alcohol",
  "vitamin",
  "supplement",
  "detergent",
  "cleaner",
  "tissue",
  "napkin",
  "battery",
  "hardware",
];

const filtered = products.filter((product) => {
  if (!supportedCategories.has(product.source_category)) {
    return false;
  }

  const name = normalize(product.name);
  return !excludedTerms.some((term) => name.includes(term));
});

console.log(`RAW PRODUCTS: ${products.length}`);
console.log(`FOOD PRODUCTS: ${filtered.length}`);
console.log(`REMOVED: ${products.length - filtered.length}`);

const categoryCounts = {};

for (const product of filtered) {
  categoryCounts[product.source_category] =
    (categoryCounts[product.source_category] || 0) + 1;
}

console.log("\nCATEGORY COUNTS:");
Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => console.log(`${category}: ${count}`));

fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));
console.log(`\nSaved: ${outputPath}`);

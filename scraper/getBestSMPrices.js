const fs = require("fs");

const products = JSON.parse(
  fs.readFileSync(
    "scraper/sm-normalized.json",
    "utf8"
  )
);

// Group products by pantry ingredient
const groups = {};

for (const product of products) {

  const ingredient =
    product.pantry_ingredient;

  if (!ingredient) {
    continue;
  }

  // Ignore products where package size
  // could not be determined
  if (
    product.price_per_100 === null
  ) {
    continue;
  }

  if (!groups[ingredient]) {
    groups[ingredient] = [];
  }

  groups[ingredient].push(product);
}


// Find cheapest normalized price
const bestPrices = [];

for (
  const [ingredient, items]
  of Object.entries(groups)
) {

  items.sort(
    (a, b) =>
      a.price_per_100 -
      b.price_per_100
  );

  const cheapest = items[0];

  bestPrices.push({

    ingredient,

    price_per_100:
      cheapest.price_per_100,

    product_name:
      cheapest.name,

    product_price:
      cheapest.price,

    package_quantity:
      cheapest.package_quantity,

    package_unit:
      cheapest.package_unit,

    package_pieces:
      cheapest.package_pieces,

    product_url:
      cheapest.url,

    products_available:
      items.length,

  });
}


// Sort alphabetically
bestPrices.sort(
  (a, b) =>
    a.ingredient.localeCompare(
      b.ingredient
    )
);


// Save
fs.writeFileSync(

  "scraper/sm-best-prices.json",

  JSON.stringify(
    bestPrices,
    null,
    2
  )

);


// Display
console.log(
  `INGREDIENTS: ${bestPrices.length}\n`
);

console.log(
  "=========================================="
);

for (const item of bestPrices) {

  console.log(
    `\n${item.ingredient}`
  );

  console.log(
    `  Cheapest: ₱${item.price_per_100} / 100${item.package_unit}`
  );

  console.log(
    `  Product: ${item.product_name}`
  );

  console.log(
    `  Package: ${item.package_quantity} ${item.package_unit}`
  );

  console.log(
    `  Price: ₱${item.product_price}`
  );

  console.log(
    `  Products available: ${item.products_available}`
  );
}

console.log(
  "\n=========================================="
);

console.log(
  "Saved: scraper/sm-best-prices.json"
);
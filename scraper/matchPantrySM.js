const fs = require("fs");
const pantryIngredients = require("./pantryIngredients");

const products = JSON.parse(
  fs.readFileSync(
    "scraper/sm-food-products.json",
    "utf8"
  )
);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Keywords → our pantry ingredient
const aliases = {
  "coconut milk": "Coconut Milk",
  "coconut cream": "Coconut Milk",
  "gata": "Coconut Milk",

  "bagoong": "Bagoong",

  "magic sarap": "Maggi Magic Sarap",

  "vinegar": "Vinegar",

  "soy sauce": "Soy Sauce",

  "sinigang": "Sinigang Mix",
  "sampalok": "Sinigang Mix",

  "patis": "Fish Sauce",
  "fish sauce": "Fish Sauce",

  "oyster sauce": "Oyster Sauce",

  "mushroom": "Mushroom",

  "flour": "All Purpose Flour",

  "black pepper": "Black Pepper",
  "peppercorn": "Black Pepper",

  "salt": "Salt",

  "corn": "Corn",

  "all purpose cream": "All Purpose Cream",

  "bihon": "Bihon",

  "laurel leaves": "Laurel Leaves",
  "bay leaf": "Laurel Leaves",

  "garlic powder": "Garlic Powder",

  "cornstarch": "Cornstarch",

  "tomato sauce": "Tomato Sauce",
  "tomato paste": "Tomato Paste",

  "liver spread": "Liver Spread",

  "shrimp paste": "Shrimp Paste",

  "chicken cubes": "Chicken Cubes",
  "pork cubes": "Pork Cubes",
  "beef cubes": "Beef Cubes",

  "spaghetti": "Spaghetti",

  "sotanghon": "Sotanghon",
  "vermicelli": "Sotanghon",
};


// Make sure our target names exist
const validIngredients =
  new Set(
    pantryIngredients.map(
      normalize
    )
  );

const results = [];

for (const product of products) {

  const name = normalize(product.name);

  let matchedIngredient = null;

  /*
    Check longer phrases first.
    This prevents "cream" from matching
    before "all purpose cream".
  */
  const sortedAliases =
    Object.entries(aliases)
      .sort(
        (a, b) =>
          b[0].length - a[0].length
      );

  for (
    const [keyword, ingredient]
    of sortedAliases
  ) {

    if (
      name.includes(
        normalize(keyword)
      )
    ) {

      if (
        validIngredients.has(
          normalize(ingredient)
        )
      ) {

        matchedIngredient =
          ingredient;

        break;

      }

    }

  }

  if (matchedIngredient) {

    results.push({
      ...product,
      pantry_ingredient:
        matchedIngredient,
    });

  }
}


// Save
fs.writeFileSync(
  "scraper/sm-pantry-matched.json",
  JSON.stringify(
    results,
    null,
    2
  )
);


// Show counts
const counts = {};

for (const product of results) {

  const ingredient =
    product.pantry_ingredient;

  counts[ingredient] =
    (counts[ingredient] || 0) + 1;

}

console.log(
  `SM PRODUCTS: ${products.length}`
);

console.log(
  `MATCHED: ${results.length}`
);

console.log(
  "\nINGREDIENT COUNTS:"
);

Object.entries(counts)
  .sort(
    (a, b) =>
      b[1] - a[1]
  )
  .forEach(
    ([ingredient, count]) => {

      console.log(
        `${ingredient}: ${count}`
      );

    }
  );

console.log(
  "\nSaved:"
);

console.log(
  "scraper/sm-pantry-matched.json"
);